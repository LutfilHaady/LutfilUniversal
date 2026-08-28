'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { StepHeader } from '@/components/mobile/step-header';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';

// Steps: 1=Scan, 2=Calibration gate (skipped if not required), 3=QC Entry, 4=Review, 5=Done
type StepId = 1 | 2 | 3 | 4 | 5;

interface QCCheckDef {
  id: string;
  qc_item_name: string;
  method: 'VisualManual' | 'ToolEquipment';
  timing: 'Startup' | 'EndOfRun';
  acceptance_criteria_text: string;
}

interface CheckValue {
  textValue: string;
  passed: boolean | null;
}

function computePassed(value: string, criteria: string): boolean | null {
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  const ltMatch = criteria.match(/^<\s*([\d.]+)/);
  if (ltMatch) return num < parseFloat(ltMatch[1]);
  const gtMatch = criteria.match(/^>\s*([\d.]+)/);
  if (gtMatch) return num > parseFloat(gtMatch[1]);
  return null; // ± ranges and other formats need manual confirmation
}

const fieldBase = 'w-full h-11 px-3 rounded-lg text-[14px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-amber-500 transition-colors';

function QCWizard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const runIdFromUrl = searchParams.get('runId');

  const [step, setStep] = useState<StepId>(1);
  const [scannedId, setScannedId] = useState('');
  const [resolvedBatch, setResolvedBatch] = useState<{ id: string; batch_number: string; material_id: string; current_quantity: number | null } | null>(null);
  const [outputBatchNumber, setOutputBatchNumber] = useState<string | null>(null);
  const [processRunId, setProcessRunId] = useState<string | null>(runIdFromUrl);
  const [requiresCalibration, setRequiresCalibration] = useState(false);
  const [checkDefs, setCheckDefs] = useState<QCCheckDef[]>([]);
  const [checkValues, setCheckValues] = useState<Record<string, CheckValue>>({});
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Display step accounts for the optional calibration step
  const displayStep = requiresCalibration ? step : step === 1 ? 1 : step - 1;
  const displayTotal = requiresCalibration ? 4 : 3;

  function next() {
    if (step === 1) { setStep(requiresCalibration ? 2 : 3); return; }
    if (step < 5) setStep((s) => (s + 1) as StepId);
  }
  function back() {
    if (step === 3 && !requiresCalibration) { setStep(1); return; }
    if (step > 1) setStep((s) => (s - 1) as StepId);
  }

  const setCheck = useCallback((defId: string, textValue: string, passed: boolean | null) => {
    setCheckValues(prev => ({ ...prev, [defId]: { textValue, passed } }));
  }, []);

  const overallPassed = checkDefs.length > 0 && Object.values(checkValues).every(v => v.passed === true);
  const allAnswered = checkDefs.length > 0 && Object.values(checkValues).every(v => v.passed !== null);

  async function handleScanContinue() {
    if (!scannedId.trim()) return;
    setBatchLoading(true);
    setBatchError(null);

    // 1. Resolve batch by batch_number (never by id)
    const { data: batch, error: batchErr } = await supabase
      .from('batches')
      .select('id, batch_number, material_id, current_quantity')
      .eq('batch_number', scannedId.trim())
      .single();

    if (batchErr || !batch) {
      setBatchError('Batch not found — check the batch number and try again.');
      setBatchLoading(false);
      return;
    }
    setResolvedBatch(batch);

    // 2. Find the associated process run (prefer URL param, fall back to lookup)
    let runId = runIdFromUrl;
    let processId: string | null = null;

    if (!runId) {
      const { data: input } = await supabase
        .from('process_run_inputs')
        .select('process_run_id')
        .eq('input_batch_id', batch.id)
        .limit(1)
        .maybeSingle();
      runId = input?.process_run_id ?? null;
    }

    if (!runId) {
      setBatchError('No process run found for this batch. Log a process step first.');
      setBatchLoading(false);
      return;
    }
    setProcessRunId(runId);

    // 3. Get process details for this run
    const { data: run } = await supabase
      .from('process_runs')
      .select('process_id')
      .eq('id', runId)
      .single();
    processId = run?.process_id ?? null;

    if (processId) {
      // 4. Check if calibration is required for this process
      const { data: proc } = await supabase
        .from('processes')
        .select('requires_calibration')
        .eq('id', processId)
        .single();
      setRequiresCalibration(proc?.requires_calibration ?? false);

      // 5. Load QC check definitions for this process
      const { data: defs } = await supabase
        .from('qc_check_definitions')
        .select('id, qc_item_name, method, timing, acceptance_criteria_text')
        .eq('process_id', processId);

      const loadedDefs = (defs ?? []) as QCCheckDef[];
      setCheckDefs(loadedDefs);
      setCheckValues(Object.fromEntries(loadedDefs.map(d => [d.id, { textValue: '', passed: null }])));
    }

    setBatchLoading(false);
    next();
  }

  async function handleSubmit() {
    if (!processRunId || !user || !resolvedBatch) return;
    setSubmitting(true);
    setSubmitError(null);

    // Insert all qc_check_results rows
    for (const def of checkDefs) {
      const check = checkValues[def.id];
      const isVisual = def.method === 'VisualManual';
      const numericVal = isVisual ? null : parseFloat(check?.textValue ?? '');
      const { error } = await supabase
        .from('qc_check_results')
        .insert({
          process_run_id:          processRunId,
          qc_check_definition_id:  def.id,
          performed_by:            user.id,
          timing:                  'EndOfRun',
          result_value_boolean:    isVisual ? (check?.passed ?? false) : null,
          result_value_numeric:    !isVisual && !isNaN(numericVal!) ? numericVal : null,
          result_text:             !isVisual ? (check?.textValue ?? '') : null,
          passed:                  check?.passed ?? false,
        });
      if (error) { setSubmitError(error.message); setSubmitting(false); return; }
    }

    // PATCH process_runs.status
    const { error: runStatusError } = await supabase
      .from('process_runs')
      .update({ status: overallPassed ? 'Passed' : 'Failed' })
      .eq('id', processRunId);

    if (runStatusError) {
      setSubmitError(runStatusError.message);
      setSubmitting(false);
      return;
    }

    if (overallPassed) {
      // Step A — construct output batch_number
      const today = new Date();
      const dateStr =
        String(today.getFullYear()) +
        String(today.getMonth() + 1).padStart(2, '0') +
        String(today.getDate()).padStart(2, '0');
      const parts = resolvedBatch.batch_number.split('-');
      const currentSuffix = parseInt(parts[parts.length - 1], 10);
      parts[1] = dateStr;

      async function insertOutputBatch(suffix: number) {
        const p = [...parts];
        p[p.length - 1] = String(suffix).padStart(2, '0');
        return supabase
          .from('batches')
          .insert({
            batch_number:      p.join('-'),
            material_id:       resolvedBatch!.material_id,
            parent_batch_id:   resolvedBatch!.id,
            status:            'Released',
            original_quantity: resolvedBatch!.current_quantity,
            current_quantity:  resolvedBatch!.current_quantity,
          })
          .select('id, batch_number')
          .single();
      }

      // Step B — INSERT output batch (retry once on duplicate batch_number)
      let { data: outputBatch, error: batchInsertErr } = await insertOutputBatch(currentSuffix + 1);
      if (batchInsertErr?.code === '23505') {
        const retry = await insertOutputBatch(currentSuffix + 2);
        batchInsertErr = retry.error;
        outputBatch = retry.data;
      }

      if (batchInsertErr || !outputBatch) {
        setSubmitError('Run passed but output batch could not be created. Contact admin.');
        setSubmitting(false);
        return;
      }

      // Step C — PATCH process_runs.output_batch_id
      const { error: runPatchError } = await supabase
        .from('process_runs')
        .update({ output_batch_id: outputBatch.id })
        .eq('id', processRunId);

      if (runPatchError) {
        setSubmitError(runPatchError.message);
        setSubmitting(false);
        return;
      }

      // Step D — INSERT batch_status_changes for the new batch
      await supabase.from('batch_status_changes').insert({
        batch_id:    outputBatch.id,
        changed_by:  user.id,
        from_status: 'InProgress',
        to_status:   'Released',
        reason:      `Output of process run ${processRunId}`,
      });

      // Step E — store for success screen
      setOutputBatchNumber(outputBatch.batch_number);
    } else {
      // QC fail path — put input batch on hold
      await supabase
        .from('batches')
        .update({ status: 'OnHold' })
        .eq('id', resolvedBatch.id);

      await supabase.from('batch_status_changes').insert({
        batch_id:    resolvedBatch.id,
        changed_by:  user.id,
        from_status: 'Released',
        to_status:   'OnHold',
        reason:      `QC failed on process run ${processRunId}`,
      });
    }

    setSubmitting(false);
    next();
  }

  function resetWizard() {
    setStep(1);
    setScannedId('');
    setResolvedBatch(null);
    setProcessRunId(runIdFromUrl);
    setRequiresCalibration(false);
    setCheckDefs([]);
    setCheckValues({});
    setBatchError(null);
    setSubmitError(null);
    setOutputBatchNumber(null);
  }

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto md:max-w-[640px]">

        {step < 5 && (
          <StepHeader
            step={displayStep}
            total={displayTotal}
            title={
              step === 1 ? 'Scan Sub-Batch' :
              step === 2 ? 'Calibration Confirmation' :
              step === 3 ? 'Enter QC Results' :
              'Review & Submit'
            }
            onBack={step > 1 ? back : undefined}
          />
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-4">

          {/* Step 1 — Scan */}
          {step === 1 && (
            <>
              <div
                className="w-full rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
                style={{ height: 200, background: '#111' }}
              >
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-amber-400 rounded-tl-xl" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-amber-400 rounded-tr-xl" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-amber-400 rounded-bl-xl" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-amber-400 rounded-br-xl" />
                <div className="text-[12px] text-[#5a5a5a]">Point at QR code</div>
                <div className="text-[10px] text-amber-500/60 mt-1 font-mono">QC mode</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#1e1e1e]" />
                <span className="text-[11px] text-[#5a5a5a] font-mono">or enter manually</span>
                <div className="flex-1 h-px bg-[#1e1e1e]" />
              </div>

              <input
                value={scannedId}
                onChange={(e) => { setScannedId(e.target.value); setBatchError(null); setResolvedBatch(null); }}
                placeholder="e.g. CTGC-20260601-A01-01"
                className={fieldBase}
              />

              {batchError && (
                <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] px-4 py-3">
                  <div className="text-[12px] text-[#fca5a5]">{batchError}</div>
                </div>
              )}

              {resolvedBatch && (
                <div className="rounded-lg border border-amber-500/30 bg-[rgba(245,158,11,0.07)] px-4 py-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-1">Found</div>
                  <div className="text-[13px] font-mono text-[#fcd34d]">{resolvedBatch.batch_number}</div>
                </div>
              )}
            </>
          )}

          {/* Step 2 — Calibration gate (only rendered when requiresCalibration) */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-amber-500/30 bg-[rgba(245,158,11,0.07)] px-5 py-5 flex flex-col gap-3">
                <div className="text-[13px] font-semibold text-[#fcd34d]">Calibration required before proceeding</div>
                <p className="text-[12px] text-[#888888] leading-relaxed">
                  This process step requires the machine to be calibrated before operation.
                  Complete calibration now, then confirm below to proceed to QC checks.
                </p>
              </div>
              <div className="rounded-xl border border-[#2a2a2a] bg-[#111] px-5 py-4 flex items-start gap-3">
                <div className="w-5 h-5 mt-0.5 rounded border border-[#3a3a3a] bg-[#1a1a1a] flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-[#22c55e]">✓</span>
                </div>
                <span className="text-[12.5px] text-[#888888] leading-relaxed">
                  I confirm that the machine has been calibrated and is ready for operation.
                </span>
              </div>
            </div>
          )}

          {/* Step 3 — QC Results entry */}
          {step === 3 && (
            <>
              {checkDefs.length === 0 ? (
                <div className="text-[12px] font-mono text-[#5a5a5a] py-6 text-center">
                  No QC checks defined for this process step.
                </div>
              ) : checkDefs.map((def) => (
                <div key={def.id} className="flex flex-col gap-2 rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12.5px] font-medium text-[#f5f5f5]">{def.qc_item_name}</span>
                      <span className="text-[10px] font-mono text-[#3a3a3a]">
                        {def.method === 'VisualManual' ? 'Visual / Manual' : 'Tool / Equipment'}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-500/60 font-mono whitespace-nowrap">
                      Spec: {def.acceptance_criteria_text}
                    </span>
                  </div>

                  {def.method === 'VisualManual' ? (
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => setCheck(def.id, 'pass', true)}
                        className={`flex-1 h-9 rounded-lg text-[12.5px] font-medium border transition-colors ${
                          checkValues[def.id]?.passed === true
                            ? 'bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.4)] text-[#22c55e]'
                            : 'bg-[#111] border-[#2a2a2a] text-[#888888] hover:border-[#3a3a3a]'
                        }`}
                      >Pass</button>
                      <button
                        onClick={() => setCheck(def.id, 'fail', false)}
                        className={`flex-1 h-9 rounded-lg text-[12.5px] font-medium border transition-colors ${
                          checkValues[def.id]?.passed === false
                            ? 'bg-[rgba(239,68,68,0.12)] border-[rgba(239,68,68,0.4)] text-[#ef4444]'
                            : 'bg-[#111] border-[#2a2a2a] text-[#888888] hover:border-[#3a3a3a]'
                        }`}
                      >Fail</button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="number"
                        step="0.01"
                        value={checkValues[def.id]?.textValue ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const computed = computePassed(val, def.acceptance_criteria_text);
                          setCheck(def.id, val, computed);
                        }}
                        className="w-full h-10 px-3 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-amber-500 transition-colors"
                        placeholder="Enter measured value"
                      />

                      {/* Auto-computed result indicator */}
                      {checkValues[def.id]?.textValue !== '' && checkValues[def.id]?.passed !== null && (
                        <div className={`text-[11px] font-mono ${checkValues[def.id]?.passed ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          {checkValues[def.id]?.passed ? '✓ Pass' : '✗ Fail'}
                        </div>
                      )}

                      {/* Manual confirmation when criteria can't be auto-computed (e.g. ± ranges) */}
                      {checkValues[def.id]?.textValue !== '' && checkValues[def.id]?.passed === null && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-mono text-[#5a5a5a]">Confirm result against spec:</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setCheck(def.id, checkValues[def.id]?.textValue ?? '', true)}
                              className="flex-1 h-9 rounded-lg text-[12.5px] font-medium border bg-[#111] border-[#2a2a2a] text-[#888888] hover:border-[rgba(34,197,94,0.4)] hover:text-[#22c55e] transition-colors"
                            >Pass</button>
                            <button
                              onClick={() => setCheck(def.id, checkValues[def.id]?.textValue ?? '', false)}
                              className="flex-1 h-9 rounded-lg text-[12.5px] font-medium border bg-[#111] border-[#2a2a2a] text-[#888888] hover:border-[rgba(239,68,68,0.4)] hover:text-[#ef4444] transition-colors"
                            >Fail</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Step 4 — Review */}
          {step === 4 && (
            <div className="flex flex-col gap-3">
              <div
                className="rounded-xl px-4 py-4 flex items-center gap-3 border"
                style={{
                  background: overallPassed ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  borderColor: overallPassed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
                }}
              >
                <span className="text-2xl">{overallPassed ? '✓' : '✗'}</span>
                <div>
                  <div className="text-[14px] font-semibold" style={{ color: overallPassed ? '#22c55e' : '#ef4444' }}>
                    {overallPassed ? 'All checks passed' : 'One or more checks failed'}
                  </div>
                  <div className="text-[11px] text-[#888888] mt-0.5">
                    Run will be marked as {overallPassed ? 'Passed' : 'Failed'}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#2a2a2a] bg-[#111] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#1e1e1e] text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                  Results
                </div>
                {checkDefs.map((def) => {
                  const check = checkValues[def.id];
                  return (
                    <div key={def.id} className="flex items-center justify-between px-4 py-2.5 border-b border-[#141414] last:border-0">
                      <span className="text-[12px] text-[#888888]">{def.qc_item_name}</span>
                      <div className="flex items-center gap-2">
                        {check?.textValue && <span className="text-[11px] font-mono text-[#5a5a5a]">{check.textValue}</span>}
                        <span className={`text-[12px] font-mono ${check?.passed ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          {check?.passed ? '✓ Pass' : '✗ Fail'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {submitError && (
                <div className="rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] px-4 py-3">
                  <p className="text-[11.5px] text-[#fca5a5] leading-relaxed">{submitError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 5 — Done */}
          {step === 5 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 py-12">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: overallPassed ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  border: `2px solid ${overallPassed ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                }}
              >
                <span className="text-2xl" style={{ color: overallPassed ? '#22c55e' : '#ef4444' }}>
                  {overallPassed ? '✓' : '✗'}
                </span>
              </div>
              <div className="text-center">
                <div className="text-[17px] font-semibold text-[#f5f5f5]">QC Record Submitted</div>
                <div className="text-[12px] mt-1" style={{ color: overallPassed ? '#22c55e' : '#ef4444' }}>
                  {overallPassed ? 'Passed' : 'Failed'}
                </div>
                <div className="text-[11px] font-mono text-[#5a5a5a] mt-0.5">
                  {resolvedBatch?.batch_number ?? '—'}
                </div>
                {overallPassed && outputBatchNumber && (
                  <div className="mt-3 rounded-lg border border-amber-500/30 bg-[rgba(245,158,11,0.07)] px-4 py-3">
                    <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-1">Output Batch</div>
                    <div className="text-[14px] font-mono font-semibold text-[#fcd34d]">{outputBatchNumber}</div>
                  </div>
                )}
              </div>
              <button
                onClick={resetWizard}
                className="mt-2 h-11 px-6 rounded-xl bg-[#161616] border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
              >
                New QC Record
              </button>
            </div>
          )}
        </div>

        {step < 5 && (
          <div className="shrink-0 px-5 py-4 border-t border-[#1a1a1a] bg-[#0a0a0a]">
            <button
              onClick={step === 1 ? handleScanContinue : step === 4 ? handleSubmit : next}
              disabled={
                (step === 1 && (!scannedId.trim() || batchLoading)) ||
                (step === 3 && !allAnswered) ||
                // Block submit until the user profile resolves — handleSubmit
                // early-returns without it, which would otherwise silently no-op.
                (step === 4 && (submitting || !user))
              }
              className="w-full h-12 rounded-xl font-semibold text-[15px] text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#f59e0b' }}
            >
              {step === 1 && batchLoading
                ? 'Looking up…'
                : step === 4
                ? submitting ? 'Submitting…' : !user ? 'Loading…' : 'Submit QC Record'
                : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QCPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0a]" />}>
      <QCWizard />
    </Suspense>
  );
}
