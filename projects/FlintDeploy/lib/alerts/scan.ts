import supabase from '@/lib/supabase';
import type { AlertRule, AlertSeverity } from '@/lib/alerts/types';

interface DesiredAlert {
  severity: AlertSeverity;
  message: string;
  batch_id: string | null;
  rule_key: string;
  dedup_key: string;
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function buildQcFail(rule: AlertRule): Promise<DesiredAlert[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data } = await supabase
    .from('qc_check_results')
    .select(
      'id, passed, created_at, def:qc_check_definitions(qc_item_name), run:process_runs(output_batch_id, output:batches!output_batch_id(batch_number))',
    )
    .eq('passed', false)
    .gte('created_at', since.toISOString());
  return (data ?? []).map((r: any) => {
    const batchNum = r.run?.output?.batch_number ?? 'Batch';
    const check = r.def?.qc_item_name ?? 'QC check';
    return {
      severity: rule.severity,
      rule_key: rule.key,
      message: `${batchNum} failed QC: ${check}`,
      batch_id: r.run?.output_batch_id ?? null,
      dedup_key: `qc_fail:${r.id}`,
    };
  });
}

async function buildBatchHeld(rule: AlertRule): Promise<DesiredAlert[]> {
  const { data } = await supabase
    .from('batches')
    .select('id, batch_number, status')
    .in('status', ['OnHold', 'Quarantine', 'Scrapped']);
  return (data ?? []).map((b: any) => ({
    severity: rule.severity,
    rule_key: rule.key,
    message: `${b.batch_number} is ${b.status}`,
    batch_id: b.id,
    dedup_key: `batch_held:${b.id}:${b.status}`,
  }));
}

async function buildMaintenanceOverdue(rule: AlertRule): Promise<DesiredAlert[]> {
  const grace = Number(rule.threshold ?? 0);
  const cutoff = addDaysISO(-grace);
  const { data } = await supabase
    .from('equipment_maintenance')
    .select('id, next_due_date, equipment:equipment(name, equipment_code)')
    .lt('next_due_date', cutoff);
  return (data ?? []).map((m: any) => ({
    severity: rule.severity,
    rule_key: rule.key,
    message: `${m.equipment?.name ?? m.equipment?.equipment_code ?? 'Equipment'} maintenance overdue (due ${m.next_due_date})`,
    batch_id: null,
    dedup_key: `maint:${m.id}`,
  }));
}

async function buildExpirySoon(rule: AlertRule): Promise<DesiredAlert[]> {
  const lead = Number(rule.threshold ?? 7);
  const { data } = await supabase
    .from('batches')
    .select('id, batch_number, expiry_date, status')
    .not('expiry_date', 'is', null)
    .lte('expiry_date', addDaysISO(lead))
    .neq('status', 'Scrapped');
  return (data ?? []).map((b: any) => ({
    severity: rule.severity,
    rule_key: rule.key,
    message: `${b.batch_number} expires ${b.expiry_date}`,
    batch_id: b.id,
    dedup_key: `expiry:${b.id}`,
  }));
}

async function buildLowStock(rule: AlertRule): Promise<DesiredAlert[]> {
  // Aggregate usable batches (InProgress, Released)
  const { data: batches } = await supabase
    .from('batches')
    .select('material_id, current_quantity')
    .in('status', ['InProgress', 'Released']);
  
  const { data: materials } = await supabase
    .from('materials')
    .select('id, name, min_storage_threshold');

  if (!batches || !materials) return [];

  const stockByMaterial = new Map<string, number>();
  batches.forEach((b: any) => {
    const q = Number(b.current_quantity ?? 0);
    stockByMaterial.set(b.material_id, (stockByMaterial.get(b.material_id) ?? 0) + q);
  });

  const desired: DesiredAlert[] = [];
  materials.forEach((m: any) => {
    const threshold = m.min_storage_threshold;
    if (threshold == null) return;
    const currentStock = stockByMaterial.get(m.id) ?? 0;
    if (currentStock < threshold) {
      desired.push({
        severity: rule.severity,
        rule_key: rule.key,
        message: `${m.name} stock (${currentStock}) is below threshold (${threshold})`,
        batch_id: null,
        dedup_key: `low_stock:${m.id}`,
      });
    }
  });
  return desired;
}

const BUILDERS: Record<string, (r: AlertRule) => Promise<DesiredAlert[]>> = {
  qc_fail: buildQcFail,
  batch_held: buildBatchHeld,
  maintenance_overdue: buildMaintenanceOverdue,
  expiry_soon: buildExpirySoon,
  low_stock: buildLowStock,
};

/**
 * Generate alerts for all enabled rules by querying current state, and
 * auto-resolve open alerts whose condition no longer holds.
 *
 * Idempotent: never double-raises an alert whose dedup_key is already active,
 * and never flips an already-resolved alert back open.
 */
export async function scanAlerts(): Promise<void> {
  const { data: rules } = await supabase.from('alert_rules').select('*').eq('enabled', true);
  if (!rules || rules.length === 0) return;

  // `desired` is the exact set of conditions that hold right now.
  const desired: DesiredAlert[] = [];
  for (const rule of rules as AlertRule[]) {
    const build = BUILDERS[rule.key];
    if (build) {
      try {
        desired.push(...(await build(rule)));
      } catch (err) {
        console.error(`[scanAlerts] builder failed for ${rule.key}`, err);
      }
    }
  }
  const desiredKeys = new Set(desired.map((d) => d.dedup_key));
  const enabledKeys = new Set((rules as AlertRule[]).map((r) => r.key));

  // Currently-open, scan-generated alerts (dedup_key present).
  const { data: open } = await supabase
    .from('alerts')
    .select('id, dedup_key, rule_key')
    .is('resolved_at', null)
    .not('dedup_key', 'is', null);
  const openAlerts = (open ?? []) as { id: string; dedup_key: string; rule_key: string }[];

  // Auto-resolve: an open alert from an enabled rule whose condition has cleared
  // (its dedup_key is no longer desired). Scoped to enabled rules so disabling a
  // rule doesn't sweep-resolve its alerts, and re-running can't flip-flop them.
  const resolveIds = new Set(
    openAlerts
      .filter((a) => enabledKeys.has(a.rule_key) && !desiredKeys.has(a.dedup_key))
      .map((a) => a.id),
  );
  if (resolveIds.size > 0) {
    const { error } = await supabase
      .from('alerts')
      .update({ resolved_at: new Date().toISOString(), resolution_source: 'auto' })
      .in('id', [...resolveIds])
      .is('resolved_at', null);
    if (error) console.error('[scanAlerts] auto-resolve failed', error);
  }

  // Explicitly check for recovered low_stock alerts not handled by auto-resolve if rules were disabled
  await resolveRecoveredLowStock();

  // Insert: conditions that hold but have no still-open alert. Reuse the open
  // fetch (minus the rows we just resolved) as the active dedup set.
  const existing = new Set(
    openAlerts.filter((a) => !resolveIds.has(a.id)).map((a) => a.dedup_key),
  );
  const toInsert = desired.filter((d) => !existing.has(d.dedup_key));
  if (toInsert.length === 0) return;

  // Partial unique index guards against concurrent scans; ignore duplicate-key races.
  const { error } = await supabase.from('alerts').insert(toInsert);
  if (error && error.code !== '23505') {
    console.error('[scanAlerts] insert failed', error);
  }
}

async function resolveRecoveredLowStock() {
  const { data: openAlerts } = await supabase
    .from('alerts')
    .select('id, dedup_key')
    .eq('rule_key', 'low_stock')
    .is('resolved_at', null);
  
  if (!openAlerts || openAlerts.length === 0) return;

  const { data: batches } = await supabase
    .from('batches')
    .select('material_id, current_quantity')
    .in('status', ['InProgress', 'Released']);
  
  const { data: materials } = await supabase
    .from('materials')
    .select('id, min_storage_threshold');

  if (!batches || !materials) return;

  const stockByMaterial = new Map<string, number>();
  batches.forEach((b: any) => {
    stockByMaterial.set(b.material_id, (stockByMaterial.get(b.material_id) ?? 0) + Number(b.current_quantity ?? 0));
  });

  const resolveIds: string[] = [];
  openAlerts.forEach((a: any) => {
    if (a.rule_key && a.rule_key !== 'low_stock') return;
    if (!a.dedup_key?.startsWith('low_stock:')) return;
    const matId = a.dedup_key.split(':')[1];
    if (!matId) return;
    const material = materials.find((m: any) => m.id === matId);
    if (!material || material.min_storage_threshold == null) {
      resolveIds.push(a.id);
      return;
    }
    const currentStock = stockByMaterial.get(matId) ?? 0;
    if (currentStock >= material.min_storage_threshold) {
      resolveIds.push(a.id);
    }
  });

  if (resolveIds.length > 0) {
    await supabase
      .from('alerts')
      .update({ resolved_at: new Date().toISOString(), resolution_source: 'auto' })
      .in('id', resolveIds)
      .is('resolved_at', null);
  }
}
