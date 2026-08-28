'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';

interface FailedResult {
  id: string;
  process_run_id: string;
  qc_item_name: string;
  process_name: string;
  batch_number: string;
  input_batch_id: string;
}

const fieldBase =
  'w-full px-3 py-2.5 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-amber-500 transition-colors resize-none';

export default function QCOverridePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [results, setResults] = useState<FailedResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Role gate — Engineer or Admin only
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'Engineer' && user.role !== 'Admin'))) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchResults = useCallback(async () => {
    setLoadingResults(true);
    setFetchError(null);

    // Fetch failed qc_check_results with QC item name and check for existing overrides
    const { data: raw, error: rawErr } = await supabase
      .from('qc_check_results')
      .select(`
        id,
        process_run_id,
        qc_check_definitions ( qc_item_name ),
        qc_overrides ( id ),
        process_runs (
          id,
          processes ( name ),
          process_run_inputs ( input_batch_id, batches ( batch_number ) )
        )
      `)
      .eq('passed', false);

    if (rawErr) {
      setFetchError('Failed to load QC results. Please refresh.');
      setLoadingResults(false);
      return;
    }

    // Filter out already-overridden results and shape into FailedResult
    const shaped: FailedResult[] = [];
    for (const r of raw ?? []) {
      const overrides = r.qc_overrides as { id: string }[] | null;
      if (overrides && overrides.length > 0) continue;

      const defArr = (r.qc_check_definitions as unknown) as { qc_item_name: string } | null;
      const run = (r.process_runs as unknown) as {
        id: string;
        processes: { name: string } | null;
        process_run_inputs: { input_batch_id: string; batches: { batch_number: string } | null }[];
      } | null;

      const firstInput = run?.process_run_inputs?.[0];
      shaped.push({
        id:              r.id,
        process_run_id:  r.process_run_id,
        qc_item_name:    defArr?.qc_item_name ?? 'Unknown check',
        process_name:    run?.processes?.name ?? '—',
        batch_number:    firstInput?.batches?.batch_number ?? '—',
        input_batch_id:  firstInput?.input_batch_id ?? '',
      });
    }

    setResults(shaped);
    setLoadingResults(false);
  }, []);

  useEffect(() => {
    if (user && (user.role === 'Engineer' || user.role === 'Admin')) {
      fetchResults();
    }
  }, [user, fetchResults]);

  async function handleSubmit() {
    if (!selectedId || !user) return;
    const target = results.find(r => r.id === selectedId);
    if (!target) return;

    // Step 1 — validate reason
    if (!overrideReason || overrideReason.trim().length === 0) {
      setSubmitError('Override reason is required.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // Step 2 — INSERT qc_overrides
    const { error: overrideErr } = await supabase
      .from('qc_overrides')
      .insert({
        qc_check_result_id: target.id,
        overridden_by:      user.id,
        override_reason:    overrideReason.trim(),
      });

    if (overrideErr) {
      setSubmitError(
        overrideErr.code === '23505'
          ? 'This result has already been overridden.'
          : 'Could not save override. Please try again.'
      );
      setSubmitting(false);
      return;
    }

    // Step 3 — PATCH process_runs.status → 'Overridden'
    const { error: runErr } = await supabase
      .from('process_runs')
      .update({ status: 'Overridden' })
      .eq('id', target.process_run_id);

    if (runErr) {
      setSubmitError('Override saved but run status could not be updated. Contact admin.');
      setSubmitting(false);
      return;
    }

    // Step 4 — Fetch the input batch for this run
    // Uses input_batch_id (not batch_id — schema correction)
    const { data: run, error: runFetchErr } = await supabase
      .from('process_runs')
      .select('output_batch_id, process_run_inputs ( input_batch_id )')
      .eq('id', target.process_run_id)
      .single();

    if (runFetchErr) {
      setSubmitError('Override saved but batch status could not be updated. Contact admin.');
      setSubmitting(false);
      return;
    }

    const inputBatchId =
      (run?.process_run_inputs as { input_batch_id: string }[] | null)?.[0]?.input_batch_id ??
      target.input_batch_id;

    if (inputBatchId) {
      // PATCH input batch back to Released
      const { error: batchErr } = await supabase
        .from('batches')
        .update({ status: 'Released' })
        .eq('id', inputBatchId);

      if (batchErr) {
        setSubmitError('Override saved but batch status could not be updated. Contact admin.');
        setSubmitting(false);
        return;
      }

      // Step 5 — INSERT batch_status_changes
      await supabase.from('batch_status_changes').insert({
        batch_id:    inputBatchId,
        changed_by:  user.id,
        from_status: 'OnHold',
        to_status:   'Released',
        reason:      `QC override by ${user.name}: ${overrideReason.trim()}`,
      });
    }

    // Step 6 — Success: clear form, refresh list
    setSuccessId(selectedId);
    setSelectedId(null);
    setOverrideReason('');
    setSubmitting(false);
    await fetchResults();
  }

  if (authLoading) {
    return <div className="h-screen bg-[#0a0a0a]" />;
  }

  if (!user || (user.role !== 'Engineer' && user.role !== 'Admin')) {
    return null;
  }

  const selected = results.find(r => r.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-5 py-6 flex flex-col gap-5 w-full mx-auto md:max-w-[720px]">
      <div>
        <div className="text-[18px] font-semibold text-[#f5f5f5]">QC Override</div>
        <div className="text-[12px] text-[#5a5a5a] mt-0.5">Engineer / Admin only — failed QC results pending review</div>
      </div>

      {/* Pending failures list */}
      <div className="flex flex-col gap-2">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
          Pending Failures
        </div>

        {loadingResults ? (
          <div className="text-[12px] font-mono text-[#3a3a3a] py-6 text-center">Loading…</div>
        ) : fetchError ? (
          <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] px-4 py-3">
            <div className="text-[12px] text-[#fca5a5]">{fetchError}</div>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] px-5 py-6 text-center">
            <div className="text-[13px] text-[#22c55e] font-medium">No failed QC results pending override</div>
            <div className="text-[11px] text-[#5a5a5a] mt-1">All checks are clear.</div>
          </div>
        ) : (
          results.map(r => (
            <button
              key={r.id}
              onClick={() => {
                setSelectedId(r.id === selectedId ? null : r.id);
                setOverrideReason('');
                setSubmitError(null);
              }}
              className={`w-full text-left rounded-xl border px-4 py-3.5 flex flex-col gap-1 transition-colors ${
                r.id === selectedId
                  ? 'border-amber-500/50 bg-[rgba(245,158,11,0.07)]'
                  : 'border-[#1e1e1e] bg-[#0f0f0f] hover:border-[#2a2a2a]'
              } ${r.id === successId ? 'opacity-40' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium text-[#f5f5f5]">{r.qc_item_name}</span>
                <span className="text-[10px] font-mono text-[#ef4444] border border-[rgba(239,68,68,0.3)] rounded px-1.5 py-0.5 shrink-0">
                  FAILED
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-[#5a5a5a]">
                <span>{r.process_name}</span>
                <span>·</span>
                <span>{r.batch_number}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Override form — shown when a result is selected */}
      {selected && (
        <div className="rounded-xl border border-amber-500/30 bg-[rgba(245,158,11,0.04)] px-5 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-[12px] font-semibold text-[#fcd34d]">Override: {selected.qc_item_name}</div>
            <div className="text-[11px] font-mono text-[#5a5a5a]">{selected.process_name} · {selected.batch_number}</div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">
              Override Reason <span className="text-[#ef4444]">*</span>
            </label>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={e => { setOverrideReason(e.target.value); setSubmitError(null); }}
              placeholder="Explain why this failure is being overridden…"
              className={fieldBase}
            />
          </div>

          {submitError && (
            <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] px-4 py-3">
              <div className="text-[12px] text-[#fca5a5]">{submitError}</div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setSelectedId(null); setOverrideReason(''); setSubmitError(null); }}
              className="flex-1 h-11 rounded-xl bg-[#141414] border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !overrideReason.trim()}
              className="flex-1 h-11 rounded-xl font-semibold text-[14px] text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#f59e0b' }}
            >
              {submitting ? 'Saving…' : 'Confirm Override'}
            </button>
          </div>
        </div>
      )}

      {/* Success banner — shown after a successful override */}
      {successId && !selectedId && (
        <div className="rounded-xl border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.07)] px-5 py-4 flex items-center gap-3">
          <span className="text-[#22c55e] text-xl">✓</span>
          <div>
            <div className="text-[13px] font-semibold text-[#22c55e]">Override recorded</div>
            <div className="text-[11px] text-[#5a5a5a] mt-0.5">Run marked Overridden · batch released.</div>
          </div>
        </div>
      )}
    </div>
  );
}
