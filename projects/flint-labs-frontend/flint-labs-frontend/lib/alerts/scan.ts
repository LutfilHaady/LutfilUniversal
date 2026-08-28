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
      'id, passed, created_at, def:qc_check_definitions(name), run:process_runs(output_batch_id, output:batches!output_batch_id(batch_number))',
    )
    .eq('passed', false)
    .gte('created_at', since.toISOString());
  return (data ?? []).map((r: any) => {
    const batchNum = r.run?.output?.batch_number ?? 'Batch';
    const check = r.def?.name ?? 'QC check';
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

const BUILDERS: Record<string, (r: AlertRule) => Promise<DesiredAlert[]>> = {
  qc_fail: buildQcFail,
  batch_held: buildBatchHeld,
  maintenance_overdue: buildMaintenanceOverdue,
  expiry_soon: buildExpirySoon,
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
    if (build) desired.push(...(await build(rule)));
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
  // TODO: `alerts` has no column distinguishing auto-resolve from manual dismiss;
  // both set resolved_at. Add e.g. `resolution = 'auto' | 'manual'` if needed.
  const resolveIds = new Set(
    openAlerts
      .filter((a) => enabledKeys.has(a.rule_key) && !desiredKeys.has(a.dedup_key))
      .map((a) => a.id),
  );
  if (resolveIds.size > 0) {
    const { error } = await supabase
      .from('alerts')
      .update({ resolved_at: new Date().toISOString() })
      .in('id', [...resolveIds])
      .is('resolved_at', null);
    if (error) console.error('[scanAlerts] auto-resolve failed', error);
  }

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
