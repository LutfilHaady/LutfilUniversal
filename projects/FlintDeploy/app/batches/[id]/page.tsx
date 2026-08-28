'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import { IconChevronRight, IconChevronLeft, IconPlus, IconExternal, IconLock, IconBatches } from '@/components/icons';
import { CreateSubBatchDrawer } from '@/components/batches/create-subbatch-drawer';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';
import { CATEGORY_TONES, BATCH_STATUS_TRANSITIONS, ALL_STATUS_TONES } from '@/lib/constants';
import type { BatchStatus } from '@/lib/types';

// ── View models (camelCase, mapped from snake_case DB rows) ─────────────
interface MainBatchView {
  id: string;
  batchNumber: string;
  materialId: string;
  materialName: string;
  materialCode: string;
  materialSuffix: string | null;
  status: BatchStatus;
  totalQty: number | null;
  currentQty: number | null;
  unit: string;
  supplier: string | null;
  supplierBatch: string | null;
  poNumber: string | null;
  sampleId: string | null;
  shelfLife: string | null;       // batches.expiry_date
  storageLocation: string | null; // batches.current_location
  received: string | null;        // intake.date_received || created_at
  createdAt: string;
}

interface SubBatchView {
  id: string;
  batchNumber: string;
  processStep: string;
  qty: number | null;
  unit: string | null;
  location: string | null;
  status: BatchStatus;
  operator: string | null;
}

interface StatusChangeView {
  id: string;
  fromStatus: BatchStatus | null;
  toStatus: BatchStatus;
  changedAt: string;
  changedByName: string | null;
  reason: string | null;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Derive the process step name from the batch_number prefix (e.g. "MIXC-…" → "Mixing (Cathode)").
function processStepFromNumber(batchNumber: string, codeToName: Record<string, string>): string {
  const code = batchNumber.split('-')[0];
  return codeToName[code] ?? code;
}

export default function MainBatchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { user, loading: authLoading } = useAuth();
  const canChangeStatus = user?.role === 'Engineer' || user?.role === 'Admin';

  const [batch, setBatch]           = useState<MainBatchView | null>(null);
  const [subBatches, setSubBatches] = useState<SubBatchView[]>([]);
  const [history, setHistory]       = useState<StatusChangeView[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [notFound, setNotFound]     = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast]           = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      // Parent batch (must be a top-level batch — parent_batch_id IS NULL)
      const { data: parent, error: parentErr } = await supabase
        .from('batches')
        .select(`
          *,
          material:materials(name, code, suffix),
          intake:batch_raw_material_intake(supplier_name, supplier_batch_no, po_number, sample_id, date_received)
        `)
        .eq('id', id)
        .is('parent_batch_id', null)
        .maybeSingle();

      if (parentErr) throw parentErr;
      if (!parent) { setNotFound(true); setLoading(false); return; }

      const intake = Array.isArray(parent.intake) ? parent.intake[0] : parent.intake;
      setBatch({
        id:              parent.id,
        batchNumber:     parent.batch_number,
        materialId:      parent.material_id,
        materialName:    parent.material?.name ?? '—',
        materialCode:    parent.material?.code ?? '—',
        materialSuffix:  parent.material?.suffix ?? null,
        status:          parent.status as BatchStatus,
        totalQty:        parent.original_quantity,
        currentQty:      parent.current_quantity,
        unit:            parent.unit ?? '',
        supplier:        intake?.supplier_name ?? null,
        supplierBatch:   intake?.supplier_batch_no ?? null,
        poNumber:        intake?.po_number ?? null,
        sampleId:        intake?.sample_id ?? null,
        shelfLife:       parent.expiry_date ?? null,
        storageLocation: parent.current_location ?? null,
        received:        intake?.date_received ?? parent.created_at,
        createdAt:       parent.created_at,
      });

      // Sub-batches, process steps (code → name) and status history in parallel
      const [{ data: subs, error: subsErr }, { data: procs }, { data: changes, error: chErr }] = await Promise.all([
        supabase
          .from('batches')
          .select('id, batch_number, status, current_quantity, original_quantity, unit, current_location')
          .eq('parent_batch_id', id)
          .order('created_at', { ascending: true }),
        supabase.from('processes').select('code, name'),
        supabase
          .from('batch_status_changes')
          .select('id, from_status, to_status, changed_at, reason, changer:users!changed_by(full_name)')
          .eq('batch_id', id)
          .order('changed_at', { ascending: false }),
      ]);

      if (subsErr) throw subsErr;
      if (chErr) throw chErr;

      const codeToName: Record<string, string> = {};
      for (const p of procs ?? []) codeToName[(p as { code: string }).code] = (p as { name: string }).name;

      const subIds = (subs ?? []).map((s) => s.id);

      // Operator + process step per sub-batch come from its producing process_run (latest).
      const runByBatch: Record<string, { operator: string | null; processName: string | null }> = {};
      if (subIds.length > 0) {
        const { data: runs } = await supabase
          .from('process_runs')
          .select('output_batch_id, created_at, process:processes(name), operator:users(full_name)')
          .in('output_batch_id', subIds)
          .order('created_at', { ascending: false });
        for (const r of runs ?? []) {
          const key = (r as { output_batch_id: string }).output_batch_id;
          if (!key || runByBatch[key]) continue; // keep the latest only
          const op = (r as { operator?: { full_name?: string } | null }).operator;
          const pr = (r as { process?: { name?: string } | null }).process;
          runByBatch[key] = { operator: op?.full_name ?? null, processName: pr?.name ?? null };
        }
      }

      setSubBatches(
        (subs ?? []).map((s) => ({
          id:          s.id,
          batchNumber: s.batch_number,
          processStep: runByBatch[s.id]?.processName ?? processStepFromNumber(s.batch_number, codeToName),
          qty:         s.current_quantity,
          unit:        s.unit,
          location:    s.current_location,
          status:      s.status as BatchStatus,
          operator:    runByBatch[s.id]?.operator ?? null,
        })),
      );

      setHistory(
        (changes ?? []).map((c) => ({
          id:           (c as { id: string }).id,
          fromStatus:   (c as { from_status: BatchStatus | null }).from_status,
          toStatus:     (c as { to_status: BatchStatus }).to_status,
          changedAt:    (c as { changed_at: string }).changed_at,
          changedByName: (c as { changer?: { full_name?: string } | null }).changer?.full_name ?? null,
          reason:       (c as { reason: string | null }).reason,
        })),
      );

      setLoading(false);
    } catch (err) {
      console.error('[MainBatchDetail] load error', err);
      setError(err instanceof Error ? err.message : 'Failed to load batch');
      setLoading(false);
    }
  }, [id]);

  // Hold the manual fetch until auth has resolved — issuing these queries
  // during the cold-load auth-lock window can hang them indefinitely.
  useEffect(() => { if (!authLoading) load(); }, [load, authLoading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Remaining = parent current_quantity (database already deducts sub-batch allocations)
  const allocated = subBatches.reduce((sum, s) => sum + (s.qty ?? 0), 0);
  const remaining = batch?.currentQty ?? 0;
  const remainingRounded = Math.round(remaining * 100) / 100;
  const allocatedRounded = Math.round(allocated * 100) / 100;
  const remainingPct =
    batch?.totalQty && batch.totalQty > 0
      ? `${Math.round((remaining / batch.totalQty) * 100)}% unused`
      : null;
  const accent = batch ? (CATEGORY_TONES[batch.materialName] ?? '#888888') : '#888888';

  const breadcrumb = (
    <div className="flex items-center gap-2 min-w-0">
      <Link href="/batches" className="text-[#888888] hover:text-[#f5f5f5] text-[13px] font-medium transition-colors">
        Batches
      </Link>
      <IconChevronRight size={13} className="text-[#5a5a5a] shrink-0" />
      <span className="font-mono text-[12.5px] text-[#f5f5f5] truncate">{batch?.batchNumber ?? id}</span>
    </div>
  );

  return (
    <Shell titleNode={breadcrumb}>
      <main className="flex-1 min-h-0 px-6 py-6 overflow-y-auto flex flex-col gap-6">

        <Link
          href="/batches"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
          aria-label="Back to Batches"
        >
          <IconChevronLeft size={14} />
          <span>Back to Batches</span>
        </Link>

        {error && (
          <div className="rounded-md border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-5 py-4 text-[12.5px] text-[#fca5a5]">
            {error}
          </div>
        )}

        {notFound && !loading && (
          <div className="flex items-center justify-center py-20 text-[12px] font-mono text-[#5a5a5a]">
            Main batch not found
          </div>
        )}

        {loading ? (
          <>
            <div className="h-8 w-64 rounded-md bg-[#161616] animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-md border border-[#2a2a2a] bg-[#161616] px-5 py-4 h-24 animate-pulse" />
              ))}
            </div>
            <div className="rounded-md border border-[#2a2a2a] bg-[#161616] h-48 animate-pulse" />
          </>
        ) : batch ? (
          <>
            {/* ── Hero ───────────────────────────────────────────────── */}
            <section className="flex items-start justify-between gap-6">
              <div className="min-w-0 flex flex-col gap-2.5">
                <h1 className="text-[30px] leading-none font-semibold font-mono tracking-tight tabular-nums truncate">
                  {batch.batchNumber}
                </h1>
                <p className="text-[13px] text-[#888888]">
                  {batch.materialName}
                  <span className="text-[#5a5a5a] mx-1.5">·</span>
                  <span className="font-mono text-[#f5f5f5]/80">{batch.materialCode}</span>
                  <span className="text-[#5a5a5a] mx-1.5">·</span>
                  Received {fmtDate(batch.received)}
                </p>
                <div className="mt-0.5">
                  <StatusBadge status={batch.status} />
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <button
                  className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] hover:text-[#f5f5f5] text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <IconExternal size={13} /> Export
                </button>
                {canChangeStatus ? (
                  <ChangeStatusControl
                    batchId={batch.id}
                    currentStatus={batch.status}
                    userId={user?.id ?? ''}
                    onChanged={(msg) => { setToast(msg); load(); }}
                  />
                ) : (
                  <button
                    disabled
                    title="Engineer / Admin only"
                    className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#1c1c1c] text-[#5a5a5a] text-[12.5px] font-medium inline-flex items-center gap-1.5 cursor-not-allowed"
                  >
                    Change status
                    <IconLock size={12} />
                  </button>
                )}
              </div>
            </section>

            {/* ── Info cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard label="Total Qty">
                <div className="text-[26px] leading-none font-semibold font-mono tabular-nums text-[#f5f5f5]">
                  {batch.totalQty != null ? `${batch.totalQty} ${batch.unit}`.trim() : '—'}
                </div>
              </InfoCard>
              <InfoCard label="Remaining">
                <div
                  className="text-[26px] leading-none font-semibold font-mono tabular-nums"
                  style={{ color: remaining < 0 ? '#f59e0b' : '#22c55e' }}
                >
                  {`${remainingRounded} ${batch.unit}`.trim()}
                </div>
                <div className="text-[11px] text-[#888888]">
                  {remainingPct ?? `${allocatedRounded} ${batch.unit} allocated`.trim()}
                </div>
              </InfoCard>
              <InfoCard label="Supplier">
                <div className="text-[15px] font-medium text-[#f5f5f5] leading-tight">{batch.supplier ?? '—'}</div>
                <div className="text-[11.5px] font-mono text-[#5a5a5a] tabular-nums">{batch.supplierBatch ?? '—'}</div>
              </InfoCard>
              <InfoCard label="Created">
                <div className="text-[14px] font-mono text-[#f5f5f5] tabular-nums leading-tight">{fmtDateTime(batch.createdAt)}</div>
                <div className="text-[11.5px] text-[#888888]">Batch registered</div>
              </InfoCard>
            </div>

            {/* ── Two-column body ────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5 items-start">
              <SubBatchesPanel
                parentDbId={batch.id}
                unit={batch.unit}
                allocated={allocatedRounded}
                rows={subBatches}
                onCreate={() => setDrawerOpen(true)}
              />
              <div className="flex flex-col gap-5">
                <IntakePanel batch={batch} />
                <StatusHistoryPanel history={history} />
              </div>
            </div>
          </>
        ) : null}
      </main>

      {drawerOpen && batch && (
        <CreateSubBatchDrawer
          parentId={batch.id}
          parentBatchNumber={batch.batchNumber}
          parentMaterialId={batch.materialId}
          parentMaterialCode={batch.materialCode}
          parentMaterialSuffix={batch.materialSuffix}
          remaining={remaining}
          unit={batch.unit}
          onClose={() => setDrawerOpen(false)}
          onCreated={() => { setToast('Sub-batch created'); load(); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 pl-1 pr-4 py-3 rounded-lg border border-[#2a2a2a] bg-[#111111] shadow-2xl">
          <div className="w-1 self-stretch rounded-full bg-[#22c55e]" />
          <span className="text-[13px] text-[#f5f5f5]">{toast}</span>
        </div>
      )}
    </Shell>
  );
}

// ── Info card ───────────────────────────────────────────────────────────
function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-md px-5 py-4 flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">{label}</div>
      {children}
    </div>
  );
}

// ── Sub-batches panel ─────────────────────────────────────────────────────
function SubBatchesPanel({
  parentDbId, unit, allocated, rows, onCreate,
}: {
  parentDbId: string;
  unit: string;
  allocated: number;
  rows: SubBatchView[];
  onCreate: () => void;
}) {
  return (
    <section className="bg-[#161616] border border-[#2a2a2a] rounded-md flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[14px] font-semibold text-[#f5f5f5]">Sub-batches</h2>
          {rows.length > 0 && (
            <span className="font-mono text-[11px] tabular-nums text-[#888888] bg-[#0a0a0a] border border-[#363636] rounded px-1.5 py-0.5">
              {rows.length}
            </span>
          )}
        </div>
        <button
          onClick={onCreate}
          className="h-9 px-3.5 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <IconPlus size={15} /> Create sub-batch
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-12 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-lg border border-[#363636] bg-[#0a0a0a] flex items-center justify-center mb-4">
            <IconBatches size={22} className="text-[#5a5a5a]" />
          </div>
          <h4 className="text-[14px] font-semibold text-[#f5f5f5]">No sub-batches yet</h4>
          <p className="text-[12.5px] text-[#888888] mt-1 max-w-[320px]">
            This material has not been split into production runs. Create the first sub-batch to begin processing.
          </p>
          <button
            onClick={onCreate}
            className="mt-5 h-9 px-4 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={15} /> Create sub-batch
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full md:min-w-[680px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.12em] text-[#5a5a5a] font-medium">
                  <th className="pl-5 pr-3 py-2.5 font-medium">Sub-batch ID</th>
                  <th className="px-3 py-2.5 font-medium">Process step</th>
                  <th className="px-3 py-2.5 font-medium">Qty</th>
                  <th className="px-3 py-2.5 font-medium">Location</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="pr-5 px-3 py-2.5 font-medium">Operator</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-[#2a2a2a] hover:bg-[#1c1c1c] transition-colors group">
                    <td className="pl-5 pr-3 py-3">
                      <Link
                        href={`/batches/${encodeURIComponent(parentDbId)}/${encodeURIComponent(s.id)}`}
                        className="font-mono text-[12px] text-[#22c55e] hover:underline"
                      >
                        {s.batchNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-[#888888]">{s.processStep}</td>
                    <td className="px-3 py-3 font-mono text-[12.5px] text-[#f5f5f5] tabular-nums">
                      {s.qty != null ? `${s.qty} ${s.unit ?? ''}`.trim() : '—'}
                    </td>
                    <td className="px-3 py-3 font-mono text-[12px] text-[#888888] tabular-nums">
                      {s.location ?? <span className="text-[#5a5a5a]">—</span>}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                    <td className="pr-5 px-3 py-3 text-[12.5px] text-[#f5f5f5]">
                      {s.operator ?? <span className="text-[#5a5a5a]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#2a2a2a] px-5 py-2.5 flex items-center justify-between text-[11.5px]">
            <span className="text-[#888888]">
              <span className="font-mono text-[#f5f5f5]">{rows.length}</span> sub-batches · {allocated} {unit} allocated
            </span>
            <span className="text-[#5a5a5a] font-mono text-[11px]">Sorted by · Created (oldest)</span>
          </div>
        </>
      )}
    </section>
  );
}

// ── Intake record panel ───────────────────────────────────────────────────
function IntakePanel({ batch }: { batch: MainBatchView }) {
  const rows: { k: string; v: string }[] = [
    { k: 'PO number',        v: batch.poNumber ?? '—' },
    { k: 'Shelf life date',  v: fmtDate(batch.shelfLife) },
    { k: 'Storage location', v: batch.storageLocation ?? '—' },
    { k: 'Sample ID',        v: batch.sampleId ?? '—' },
  ];
  return (
    <section className="bg-[#161616] border border-[#2a2a2a] rounded-md flex flex-col">
      <div className="px-5 pt-4 pb-3 border-b border-[#2a2a2a]">
        <h3 className="text-[14px] font-semibold text-[#f5f5f5]">Intake record</h3>
        <p className="text-[11.5px] text-[#888888]">Receiving details captured at registration</p>
      </div>
      <div className="px-5 py-3.5 flex flex-col">
        {rows.map((row, i) => (
          <div
            key={row.k}
            className={'flex items-baseline justify-between gap-4 py-2.5 ' + (i > 0 ? 'border-t border-[#1f1f1f]' : '')}
          >
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-[#888888] font-medium">{row.k}</span>
            <span className="font-mono text-[12.5px] text-[#f5f5f5] tabular-nums text-right">{row.v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Status history (timeline) ─────────────────────────────────────────────
function StatusHistoryPanel({ history }: { history: StatusChangeView[] }) {
  return (
    <section className="bg-[#161616] border border-[#2a2a2a] rounded-md flex flex-col">
      <div className="px-5 pt-4 pb-3 border-b border-[#2a2a2a]">
        <h3 className="text-[14px] font-semibold text-[#f5f5f5]">Status history</h3>
        <p className="text-[11.5px] text-[#888888]">Audit log of status transitions</p>
      </div>
      {history.length === 0 ? (
        <div className="px-5 py-8 text-center text-[12px] font-mono text-[#5a5a5a]">
          No status changes recorded yet.
        </div>
      ) : (
        <div className="px-5 py-4 flex flex-col gap-4">
          {history.map((e, i) => (
            <StatusHistoryEntry key={e.id} entry={e} isLast={i === history.length - 1} />
          ))}
        </div>
      )}
    </section>
  );
}

function StatusHistoryEntry({ entry, isLast }: { entry: StatusChangeView; isLast: boolean }) {
  const dot = ALL_STATUS_TONES[entry.toStatus]?.dot ?? '#5a5a5a';
  return (
    <div className="relative pl-7">
      {!isLast && <div className="absolute left-[8.5px] top-6 bottom-[-14px] w-px bg-[#2a2a2a]" />}
      <div className="absolute left-1 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-[#363636] bg-[#0a0a0a] flex items-center justify-center">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      </div>
      <div className="pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          {entry.fromStatus
            ? <StatusBadge status={entry.fromStatus} />
            : <span className="font-mono text-[10.5px] text-[#5a5a5a] uppercase tracking-[0.1em] px-1.5 py-0.5 border border-[#363636] rounded bg-[#0a0a0a]">Registered</span>}
          <IconChevronRight size={13} className="text-[#5a5a5a]" />
          <StatusBadge status={entry.toStatus} />
        </div>
        <div className="mt-1.5 text-[12px] text-[#888888]">
          {entry.changedByName && <span className="text-[#f5f5f5]">{entry.changedByName}</span>}
          {entry.changedByName && <span className="mx-2 text-[#5a5a5a]">·</span>}
          <span className="font-mono tabular-nums">{fmtDateTime(entry.changedAt)}</span>
        </div>
        {entry.reason && <div className="mt-1 text-[12px] text-[#f5f5f5]/80 leading-snug">{entry.reason}</div>}
      </div>
    </div>
  );
}

// ── Change status control (Engineer / Admin only) ────────────────────────
function ChangeStatusControl({
  batchId, currentStatus, userId, onChanged,
}: {
  batchId: string;
  currentStatus: BatchStatus;
  userId: string;
  onChanged: (msg: string) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [target, setTarget]   = useState<BatchStatus | null>(null);
  const [reason, setReason]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  const options = BATCH_STATUS_TRANSITIONS[currentStatus] ?? [];

  function close() {
    setOpen(false);
    setTarget(null);
    setReason('');
    setErr(null);
  }

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc('transition_batch_status', {
      p_batch_id:   batchId,
      p_new_status: target,
      p_reason:     reason.trim() || null,
      p_user_id:    userId,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    close();
    onChanged(`Status changed to ${target}`);
  }

  return (
    <div className="relative">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        disabled={options.length === 0}
        className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#f5f5f5] text-[12.5px] font-medium hover:bg-[#1e1e1e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={options.length === 0 ? `${currentStatus} is a terminal status` : undefined}
      >
        Change status
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 top-11 z-50 w-72 rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] shadow-2xl p-3 flex flex-col gap-2">
            {err && (
              <div className="px-3 py-2 rounded-md bg-[rgba(239,68,68,.12)] border border-[rgba(239,68,68,.3)] text-[11.5px] text-[#fca5a5] font-mono">
                {err}
              </div>
            )}
            <div className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">New status</div>
            <div className="flex flex-wrap gap-1.5">
              {options.map((s) => (
                <button
                  key={s}
                  onClick={() => setTarget(s)}
                  className={
                    'px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ' +
                    (target === s
                      ? 'border-[#22c55e] bg-[rgba(34,197,94,.1)] text-[#86efac]'
                      : 'border-[#2a2a2a] text-[#888888] hover:text-[#f5f5f5] hover:border-[#363636]')
                  }
                >
                  {s}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason (recorded in audit log)…"
              className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors resize-none"
            />
            <button
              onClick={confirm}
              disabled={!target || busy}
              className="h-8 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? 'Saving…' : target ? `Set to ${target}` : 'Select a status'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
