'use client';

import { useState, useEffect, Suspense, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';
import { Scanner, setZXingModuleOverrides } from '@yudiel/react-qr-scanner';
import { cameraErrorMessage } from '@/lib/camera-error';

setZXingModuleOverrides({
  locateFile: (path: string) => path.endsWith('.wasm') ? `/${path}` : path,
});

type QcBranch = 'visual' | 'bounded' | 'target-relative' | 'scrap';

interface QCCheckDef {
  id: string;
  qc_item_name: string;
  method: 'VisualManual' | 'ToolEquipment';
  timing: 'Startup' | 'EndOfRun';
  acceptance_criteria_text: string;
  acceptance_criteria_min: number | null;
  acceptance_criteria_max: number | null;
  is_active: boolean;
}

interface CheckValue {
  passed: boolean | null;
  measuredValue: string;
  notes: string;
  targetValue: string;
  defectCount: string;
}

interface Tolerance {
  type: 'percent' | 'absolute';
  value: number;
}

function getQcBranch(def: QCCheckDef): QcBranch {
  if (def.method === 'VisualManual' && def.acceptance_criteria_max != null) return 'scrap';
  if (def.method === 'VisualManual') return 'visual';
  if (def.acceptance_criteria_min != null || def.acceptance_criteria_max != null) return 'bounded';
  return 'target-relative';
}

function parseTolerance(text: string): Tolerance | null {
  const pctMatch = text.match(/±\s*([\d.]+)\s*%/);
  if (pctMatch) return { type: 'percent', value: parseFloat(pctMatch[1]) / 100 };
  const absMatch = text.match(/±\s*([\d.]+)\s*mm/i);
  if (absMatch) return { type: 'absolute', value: parseFloat(absMatch[1]) };
  return null;
}

function computeBoundedPassed(value: string, min: number | null, max: number | null): boolean | null {
  if (value.trim() === '') return null;
  const v = Number(value);
  if (Number.isNaN(v)) return false;
  if (min != null && v < min) return false;
  if (max != null && v > max) return false;
  return true;
}

function computeTargetRelativePassed(measured: string, target: string, toleranceText: string): boolean | null {
  const m = parseFloat(measured);
  const t = parseFloat(target);
  if (isNaN(m) || isNaN(t) || t === 0) return null;
  const tol = parseTolerance(toleranceText);
  if (!tol) return null;
  if (tol.type === 'percent') return Math.abs(m - t) / t <= tol.value;
  return Math.abs(m - t) <= tol.value;
}

function computeScrapPassed(defectCount: string, throughput: number | null, maxRate: number): boolean | null {
  if (throughput == null || throughput <= 0) return null;
  const count = parseFloat(defectCount);
  if (isNaN(count) || count < 0) return null;
  const rate = (count / throughput) * 100;
  return rate <= maxRate;
}

function formatDefectRate(defectCount: string, throughput: number | null): string | null {
  if (throughput == null || throughput <= 0) return null;
  const count = parseFloat(defectCount);
  if (isNaN(count)) return null;
  return ((count / throughput) * 100).toFixed(1);
}

function specLabel(def: QCCheckDef, branch: QcBranch): string {
  if (branch === 'bounded') {
    if (def.acceptance_criteria_min != null && def.acceptance_criteria_max != null)
      return `${def.acceptance_criteria_min} – ${def.acceptance_criteria_max}`;
    if (def.acceptance_criteria_min != null) return `≥ ${def.acceptance_criteria_min}`;
    if (def.acceptance_criteria_max != null) return `≤ ${def.acceptance_criteria_max}`;
  }
  if (branch === 'scrap') return `Scrap ≤ ${def.acceptance_criteria_max}%`;
  return def.acceptance_criteria_text;
}

const fieldBase = 'w-full h-11 px-3 rounded-lg text-[14px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-amber-500 transition-colors';

function QCWizard() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const runIdFromUrl = searchParams.get('runId');

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
  const [throughput, setThroughput] = useState<number | null>(null);
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        router.push('/batches');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [submitted, router]);

  const hasScrapChecks = checkDefs.some(d => getQcBranch(d) === 'scrap');
  const scrapBlocked = hasScrapChecks && throughput == null;
  const overallPassed = checkDefs.length > 0 && Object.values(checkValues).every(v => v.passed === true);
  const allAnswered = checkDefs.length > 0 && !scrapBlocked && Object.values(checkValues).every(v => v.passed !== null);

  const section1Complete = resolvedBatch !== null;
  const section2Complete = section1Complete && (!requiresCalibration || calibrationConfirmed);
  const section3Complete = section2Complete && allAnswered;

  // Dynamic section numbers — calibration section only counted when present
  const qcSectionN = requiresCalibration ? 3 : 2;
  const submitSectionN = requiresCalibration ? 4 : 3;

  function updateCheck(defId: string, updates: Partial<CheckValue>) {
    setCheckValues(prev => ({ ...prev, [defId]: { ...prev[defId], ...updates } }));
  }

  function editBatch() {
    setResolvedBatch(null);
    setProcessRunId(runIdFromUrl);
    setRequiresCalibration(false);
    setCheckDefs([]);
    setCheckValues({});
    setBatchError(null);
    setCalibrationConfirmed(false);
    setThroughput(null);
    setCameraErrorMsg(null);
  }

  // Auto-load when redirected from active-run-drawer with runId + batchNumber in URL
  const batchNumberFromUrl = searchParams.get('batchNumber');
  useEffect(() => {
    if (runIdFromUrl && batchNumberFromUrl && !resolvedBatch) {
      setScannedId(batchNumberFromUrl);
      handleFindBatch(batchNumberFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFindBatch(idOverride?: string) {
    const id = (idOverride ?? scannedId).trim();
    if (!id) return;
    setBatchLoading(true);
    setBatchError(null);

    try {
      const { data: batch, error: batchErr } = await supabase
        .from('batches')
        .select('id, batch_number, material_id, current_quantity')
        .eq('batch_number', id)
        .single();

      if (batchErr || !batch) {
        setBatchError('Batch not found — check the batch number and try again.');
        return;
      }

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
        return;
      }

      const { data: run } = await supabase
        .from('process_runs')
        .select('process_id')
        .eq('id', runId)
        .single();
      processId = run?.process_id ?? null;

      let loadedDefs: QCCheckDef[] = [];
      let calibRequired = false;
      let tp: number | null = null;

      if (processId) {
        const { data: proc } = await supabase
          .from('processes')
          .select('requires_calibration')
          .eq('id', processId)
          .single();
        calibRequired = proc?.requires_calibration ?? false;

        const { data: defs } = await supabase
          .from('qc_check_definitions')
          .select('id, qc_item_name, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, is_active')
          .eq('process_id', processId)
          .eq('is_active', true);

        loadedDefs = (defs ?? []) as QCCheckDef[];

        const hasScrap = loadedDefs.some(d => getQcBranch(d) === 'scrap');
        if (hasScrap && runId) {
          const { data: params } = await supabase
            .from('process_run_parameters')
            .select('parameter_key, value')
            .eq('process_run_id', runId)
            .in('parameter_key', ['pcs_cut', 'cell_assembled']);

          if (params && params.length > 0) {
            const tpVal = parseFloat(params[0].value);
            if (!isNaN(tpVal) && tpVal > 0) tp = tpVal;
          }
        }
      }

      // Only resolve the batch after all lookups succeed
      setResolvedBatch(batch);
      setProcessRunId(runId);
      setRequiresCalibration(calibRequired);
      setCheckDefs(loadedDefs);
      setCheckValues(Object.fromEntries(
        loadedDefs.map(d => [d.id, { passed: null, measuredValue: '', notes: '', targetValue: '', defectCount: '' }])
      ));
      setThroughput(tp);
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleSubmit() {
    if (!processRunId || !user || !resolvedBatch) return;
    setSubmitting(true);
    setSubmitError(null);

    for (const def of checkDefs) {
      const check = checkValues[def.id];
      const branch = getQcBranch(def);

      let resultValueNumeric: number | null = null;
      let resultValueBoolean: boolean | null = null;
      let resultText: string | null = null;

      switch (branch) {
        case 'visual':
          resultValueBoolean = check.passed;
          resultText = check.notes || null;
          break;
        case 'bounded': {
          const v = parseFloat(check.measuredValue);
          resultValueNumeric = isNaN(v) ? null : v;
          break;
        }
        case 'target-relative': {
          const v = parseFloat(check.measuredValue);
          const t = parseFloat(check.targetValue);
          resultValueNumeric = isNaN(v) ? null : v;
          if (!isNaN(v) && !isNaN(t) && t !== 0) {
            const tol = parseTolerance(def.acceptance_criteria_text);
            if (tol) {
              const dev = tol.type === 'percent'
                ? `${((Math.abs(v - t) / t) * 100).toFixed(1)}%`
                : `${Math.abs(v - t).toFixed(2)} mm`;
              const limit = tol.type === 'percent'
                ? `${(tol.value * 100).toFixed(0)}%`
                : `${tol.value} mm`;
              resultText = `Target ${t}, measured ${v}, deviation ${dev} (tolerance ${limit}).`;
            }
          }
          break;
        }
        case 'scrap': {
          const count = parseFloat(check.defectCount);
          resultValueNumeric = isNaN(count) ? null : count;
          if (!isNaN(count) && throughput != null && throughput > 0) {
            const rate = (count / throughput) * 100;
            resultText = `Defect rate ${rate.toFixed(1)}% (threshold ${def.acceptance_criteria_max}%).`;
          }
          break;
        }
      }

      const { error } = await supabase
        .from('qc_check_results')
        .insert({
          process_run_id:          processRunId,
          qc_check_definition_id: def.id,
          performed_by:           user.id,
          timing:                 'EndOfRun',
          result_value_boolean:   resultValueBoolean,
          result_value_numeric:   resultValueNumeric,
          result_text:            resultText,
          passed:                 check.passed ?? false,
        });
      if (error) { setSubmitError(error.message); setSubmitting(false); return; }
    }

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
      const today = new Date();
      const dateStr =
        String(today.getFullYear()) +
        String(today.getMonth() + 1).padStart(2, '0') +
        String(today.getDate()).padStart(2, '0');
      const parts = resolvedBatch.batch_number.split('-');
      parts[1] = dateStr;

      // Fix NaN suffix: strip any alphabetic prefix before parsing the integer
      const lastPart = parts[parts.length - 1];
      const suffixMatch = lastPart.match(/^([A-Za-z]*)(\d+)$/);
      const suffixPrefix = suffixMatch?.[1] ?? '';
      const suffixDigits = suffixMatch?.[2] ?? '';
      const currentNum = suffixDigits ? parseInt(suffixDigits, 10) : NaN;

      function fmtSuffix(delta: number): string {
        if (isNaN(currentNum)) return '01';
        const n = currentNum + delta;
        return suffixPrefix ? suffixPrefix + String(n) : String(n).padStart(2, '0');
      }

      async function insertOutputBatch(delta: number) {
        const p = [...parts];
        p[p.length - 1] = fmtSuffix(delta);
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

      let { data: outputBatch, error: batchInsertErr } = await insertOutputBatch(1);
      if (batchInsertErr?.code === '23505') {
        const retry = await insertOutputBatch(2);
        batchInsertErr = retry.error;
        outputBatch = retry.data;
      }

      if (batchInsertErr || !outputBatch) {
        setSubmitError('Run passed but output batch could not be created. Contact admin.');
        setSubmitting(false);
        return;
      }

      const { error: runPatchError } = await supabase
        .from('process_runs')
        .update({ output_batch_id: outputBatch.id })
        .eq('id', processRunId);

      if (runPatchError) {
        setSubmitError(runPatchError.message);
        setSubmitting(false);
        return;
      }

      await supabase.from('batch_status_changes').insert({
        batch_id:    outputBatch.id,
        changed_by:  user.id,
        from_status: 'InProgress',
        to_status:   'Released',
        reason:      `Output of process run ${processRunId}`,
      });

      setOutputBatchNumber(outputBatch.batch_number);
    } else {
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
    setSubmitted(true);
  }

  function resetWizard() {
    setScannedId('');
    setResolvedBatch(null);
    setProcessRunId(runIdFromUrl);
    setRequiresCalibration(false);
    setCheckDefs([]);
    setCheckValues({});
    setBatchError(null);
    setSubmitError(null);
    setOutputBatchNumber(null);
    setThroughput(null);
    setCalibrationConfirmed(false);
    setCameraErrorMsg(null);
    setSubmitted(false);
  }

  function SectionHeading({ n, title }: { n: number; title: string }) {
    return (
      <div className="flex items-center gap-2.5">
        <span className="w-5 h-5 rounded-full bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-[10px] font-mono text-[#5a5a5a]">{n}</span>
        <h2 className="text-[12px] font-semibold text-[#f5f5f5]">{title}</h2>
      </div>
    );
  }

  function CollapsedRow({ n, value, onEdit }: { n: number; value: ReactNode; onEdit: () => void }) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#1f2a1f] bg-[#0c130c]">
        <span className="w-4 h-4 rounded-full bg-[#22c55e] flex items-center justify-center shrink-0">
          <span className="text-[8px] text-black font-bold">✓</span>
        </span>
        <div className="flex-1 min-w-0 text-[13px] text-[#f5f5f5] truncate">{value}</div>
        <button onClick={onEdit} className="text-[11px] text-[#86efac] hover:text-[#bbf7d0] shrink-0">Edit</button>
      </div>
    );
  }

  function renderCheckCard(def: QCCheckDef) {
    const branch = getQcBranch(def);
    const check = checkValues[def.id];
    if (!check) return null;

    return (
      <div key={def.id} className="flex flex-col gap-2 rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12.5px] font-medium text-[#f5f5f5]">{def.qc_item_name}</span>
            <span className="text-[10px] font-mono text-[#3a3a3a]">
              {branch === 'visual' ? 'Visual / Manual' :
               branch === 'scrap' ? 'Defect Rate' :
               branch === 'target-relative' ? 'Target-Relative' :
               'Tool / Equipment'}
            </span>
          </div>
          <span className="text-[10px] text-amber-500/60 font-mono whitespace-nowrap">
            Spec: {specLabel(def, branch)}
          </span>
        </div>

        {branch === 'visual' && (
          <>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => updateCheck(def.id, { passed: true })}
                className={`flex-1 h-9 rounded-lg text-[12.5px] font-medium border transition-colors ${
                  check.passed === true
                    ? 'bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.4)] text-[#22c55e]'
                    : 'bg-[#111] border-[#2a2a2a] text-[#888888] hover:border-[#3a3a3a]'
                }`}
              >Pass</button>
              <button
                onClick={() => updateCheck(def.id, { passed: false })}
                className={`flex-1 h-9 rounded-lg text-[12.5px] font-medium border transition-colors ${
                  check.passed === false
                    ? 'bg-[rgba(239,68,68,0.12)] border-[rgba(239,68,68,0.4)] text-[#ef4444]'
                    : 'bg-[#111] border-[#2a2a2a] text-[#888888] hover:border-[#3a3a3a]'
                }`}
              >Fail</button>
            </div>
            <input
              value={check.notes}
              onChange={(e) => updateCheck(def.id, { notes: e.target.value })}
              placeholder="Notes (optional)"
              className="w-full h-9 px-3 rounded-lg text-[12px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-amber-500 transition-colors"
            />
          </>
        )}

        {branch === 'bounded' && (
          <>
            <input
              type="number"
              step="0.01"
              value={check.measuredValue}
              onChange={(e) => {
                const val = e.target.value;
                const passed = computeBoundedPassed(val, def.acceptance_criteria_min, def.acceptance_criteria_max);
                updateCheck(def.id, { measuredValue: val, passed });
              }}
              className="w-full h-10 px-3 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-amber-500 transition-colors"
              placeholder="Enter measured value"
            />
            {check.measuredValue !== '' && check.passed !== null && (
              <div className={`text-[11px] font-mono ${check.passed ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {check.passed ? '✓ Pass' : '✗ Fail'}
              </div>
            )}
          </>
        )}

        {branch === 'target-relative' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-[#5a5a5a] mb-1 block">Target Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={check.targetValue}
                  onChange={(e) => {
                    const target = e.target.value;
                    const passed = computeTargetRelativePassed(check.measuredValue, target, def.acceptance_criteria_text);
                    updateCheck(def.id, { targetValue: target, passed });
                  }}
                  className="w-full h-10 px-3 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-amber-500 transition-colors"
                  placeholder="Target"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#5a5a5a] mb-1 block">Measured Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={check.measuredValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    const passed = computeTargetRelativePassed(val, check.targetValue, def.acceptance_criteria_text);
                    updateCheck(def.id, { measuredValue: val, passed });
                  }}
                  className="w-full h-10 px-3 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-amber-500 transition-colors"
                  placeholder="Measured"
                />
              </div>
            </div>
            {check.measuredValue !== '' && check.targetValue !== '' && (
              <>
                {check.passed !== null ? (
                  <div className={`text-[11px] font-mono ${check.passed ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {(() => {
                      const m = parseFloat(check.measuredValue);
                      const t = parseFloat(check.targetValue);
                      const tol = parseTolerance(def.acceptance_criteria_text);
                      if (isNaN(m) || isNaN(t) || !tol) return check.passed ? '✓ Pass' : '✗ Fail';
                      const dev = tol.type === 'percent'
                        ? `${((Math.abs(m - t) / t) * 100).toFixed(1)}% deviation`
                        : `${Math.abs(m - t).toFixed(2)} mm deviation`;
                      return `${check.passed ? '✓ Pass' : '✗ Fail'} — ${dev}`;
                    })()}
                  </div>
                ) : (
                  <div className="text-[10px] font-mono text-[#5a5a5a]">Enter both values to compute result</div>
                )}
              </>
            )}
          </>
        )}

        {branch === 'scrap' && (
          <>
            {throughput == null ? (
              <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] px-3 py-2.5">
                <div className="text-[11px] text-[#fca5a5]">
                  Enter Pcs Cut / Cell Assembled in the process log first
                </div>
              </div>
            ) : (
              <>
                <div className="text-[10px] font-mono text-[#5a5a5a]">
                  Throughput: {throughput} pcs
                </div>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={check.defectCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    const passed = computeScrapPassed(val, throughput, def.acceptance_criteria_max!);
                    updateCheck(def.id, { defectCount: val, passed });
                  }}
                  className="w-full h-10 px-3 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-amber-500 transition-colors"
                  placeholder="Defect count"
                />
                {check.defectCount !== '' && (() => {
                  const rate = formatDefectRate(check.defectCount, throughput);
                  if (!rate) return null;
                  return (
                    <div className={`text-[11px] font-mono ${check.passed ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {check.passed ? '✓ Pass' : '✗ Fail'} — {rate}% (threshold {def.acceptance_criteria_max}%)
                    </div>
                  );
                })()}
              </>
            )}
          </>
        )}
      </div>
    );
  }

  function reviewValue(def: QCCheckDef): string {
    const check = checkValues[def.id];
    if (!check) return '—';
    const branch = getQcBranch(def);
    switch (branch) {
      case 'visual': return check.notes || (check.passed ? 'Pass' : 'Fail');
      case 'bounded': return check.measuredValue || '—';
      case 'target-relative': {
        if (!check.measuredValue || !check.targetValue) return '—';
        return `${check.measuredValue} (target ${check.targetValue})`;
      }
      case 'scrap': {
        const rate = formatDefectRate(check.defectCount, throughput);
        return rate ? `${check.defectCount} defects (${rate}%)` : check.defectCount || '—';
      }
    }
  }

  // Success screen
  if (submitted) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto md:max-w-[640px]">
          <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col items-center justify-center gap-4 py-12">
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
            <div className="flex gap-2.5 mt-2">
              <button
                onClick={resetWizard}
                className="h-11 px-5 rounded-xl bg-[#161616] border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
              >
                New QC Record
              </button>
              <button
                onClick={() => router.push('/batches')}
                className="h-11 px-5 rounded-xl bg-[#f59e0b] text-black font-semibold text-[13px] hover:bg-amber-500 transition-colors"
              >
                Go to Batches
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto md:max-w-[640px]">

        <div className="shrink-0 px-5 py-3 border-b border-[#1a1a1a]">
          <span className="text-[12px] font-semibold text-[#f5f5f5]">QC Log</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

          {/* ── Section 1 — Scan Batch ── */}
          {section1Complete ? (
            <CollapsedRow
              n={1}
              value={<>Batch — <span className="font-mono text-[#86efac]">{resolvedBatch!.batch_number}</span></>}
              onEdit={editBatch}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <SectionHeading n={1} title="Scan Batch" />
              <div
                className="w-full rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
                style={{ height: 200, background: '#111', border: `1px solid ${cameraErrorMsg ? 'rgba(245,158,11,0.3)' : '#1e1e1e'}` }}
              >
                {cameraErrorMsg ? (
                  <div className="flex flex-col items-center gap-2.5 px-5 text-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4a4a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
                      <rect x="5" y="5" width="3" height="3" fill="#4a4a4a"/><rect x="16" y="5" width="3" height="3" fill="#4a4a4a"/><rect x="5" y="16" width="3" height="3" fill="#4a4a4a"/>
                      <path d="M14 14h3v3M21 14v3M14 21h3M21 21v-3"/>
                    </svg>
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#f59e0b]">Camera unavailable</div>
                      <div className="text-[11px] text-[#888888] mt-0.5">{cameraErrorMsg}</div>
                    </div>
                  </div>
                ) : (
                  <Scanner
                    onScan={(result) => {
                      if (result && result.length > 0) {
                        setScannedId(result[0].rawValue);
                        setBatchError(null);
                      }
                    }}
                    onError={(err) => setCameraErrorMsg(cameraErrorMessage(err))}
                    constraints={{ facingMode: { ideal: 'environment' } }}
                    components={{ torch: false, zoom: false, finder: true }}
                    styles={{ container: { width: '100%', height: '100%' } }}
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#1e1e1e]" />
                <span className="text-[11px] text-[#5a5a5a] font-mono">or enter manually</span>
                <div className="flex-1 h-px bg-[#1e1e1e]" />
              </div>

              <div className="flex gap-2">
                <input
                  value={scannedId}
                  onChange={(e) => { setScannedId(e.target.value); setBatchError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFindBatch(); } }}
                  placeholder="e.g. CTGC-20260601-A01-01"
                  className={fieldBase}
                />
                <button
                  onClick={() => handleFindBatch()}
                  disabled={!scannedId.trim() || batchLoading}
                  className="px-5 bg-[#f59e0b] text-black font-semibold rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {batchLoading ? '…' : 'Find batch'}
                </button>
              </div>

              {batchError && (
                <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] px-4 py-3">
                  <div className="text-[12px] text-[#fca5a5]">{batchError}</div>
                </div>
              )}
            </div>
          )}

          {/* ── Section 2 — Calibration Confirmation (conditional) ── */}
          {section1Complete && requiresCalibration && (
            calibrationConfirmed ? (
              <CollapsedRow
                n={2}
                value="Calibration confirmed"
                onEdit={() => setCalibrationConfirmed(false)}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <SectionHeading n={2} title="Calibration Confirmation" />
                <div className="rounded-xl border border-amber-500/30 bg-[rgba(245,158,11,0.07)] px-5 py-5 flex flex-col gap-3">
                  <div className="text-[13px] font-semibold text-[#fcd34d]">Calibration required before proceeding</div>
                  <p className="text-[12px] text-[#888888] leading-relaxed">
                    This process step requires the machine to be calibrated before operation.
                    Complete calibration now, then confirm below to proceed to QC checks.
                  </p>
                </div>
                <button
                  onClick={() => setCalibrationConfirmed(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-colors border-[#2a2a2a] bg-[#111] hover:border-[#3a3a3a]"
                >
                  <span className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 border-[#3a3a3a]" />
                  <span className="text-[13px] text-[#888888]">
                    I confirm that the machine has been calibrated and is ready for operation.
                  </span>
                </button>
              </div>
            )
          )}

          {/* ── Section 3 — QC Checks ── */}
          {section2Complete && (
            <div className="flex flex-col gap-3">
              <SectionHeading n={qcSectionN} title="QC Checks" />
              {checkDefs.length === 0 ? (
                <div className="text-[12px] font-mono text-[#5a5a5a] py-6 text-center">
                  No QC checks defined for this process step.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {checkDefs.map(def => renderCheckCard(def))}
                </div>
              )}
            </div>
          )}

          {/* ── Section 4 — Submit Results ── */}
          {section3Complete && (
            <div className="flex flex-col gap-3">
              <SectionHeading n={submitSectionN} title="Submit Results" />

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
                        <span className="text-[11px] font-mono text-[#5a5a5a]">{reviewValue(def)}</span>
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

              <button
                onClick={handleSubmit}
                disabled={submitting || !user}
                className="w-full h-12 rounded-xl font-semibold text-[15px] text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#f59e0b' }}
              >
                {submitting ? 'Submitting…' : !user ? 'Loading…' : 'Submit QC Record'}
              </button>
            </div>
          )}

        </div>
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
