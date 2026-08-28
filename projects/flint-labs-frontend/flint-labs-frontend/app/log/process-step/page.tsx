'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mutate } from 'swr';
import { Scanner } from '@yudiel/react-qr-scanner';
import { StepHeader } from '@/components/mobile/step-header';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';
import { useProcessRoute, type ProcessStep } from '@/lib/hooks/useProcessRoute';

type StepId = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_TITLES: Record<StepId, string> = {
  1: 'Scan Sub-Batch',
  2: 'Select Process Step',
  3: 'Calibration Check',
  4: 'Enter Parameters',
  5: 'Confirm & Submit',
  6: 'Done',
};

const PARAMS_BY_CODE: Record<string, { label: string; unit: string; placeholder: string }[]> = {
  CTGC: [
    { label: 'Substrate Feeding Speed', unit: 'm/min', placeholder: '2.5' },
    { label: 'Coating Blade Gap', unit: 'µm', placeholder: '200' },
    { label: 'Transfer Gap', unit: 'µm', placeholder: '150' },
    { label: 'Temperature', unit: '°C', placeholder: '80' },
    { label: 'Coating Length', unit: 'm', placeholder: '50' },
  ],
  CALC: [
    { label: 'Force', unit: 'kN', placeholder: '50' },
    { label: 'Feed Rate', unit: 'm/min', placeholder: '5' },
    { label: 'Roller Gap', unit: 'µm', placeholder: '120' },
  ],
  DICC: [
    { label: 'Cutting Piston Travel Depth', unit: 'mm', placeholder: '10' },
    { label: 'Distance Between Cuts', unit: 'mm', placeholder: '50' },
    { label: 'Machine Feed Rate', unit: 'cuts/min', placeholder: '20' },
    { label: 'Length Cut', unit: 'mm', placeholder: '150' },
  ],
  DICA: [
    { label: 'Cutting Piston Travel Depth', unit: 'mm', placeholder: '10' },
    { label: 'Distance Between Cuts', unit: 'mm', placeholder: '50' },
    { label: 'Machine Feed Rate', unit: 'cuts/min', placeholder: '20' },
    { label: 'Length Cut', unit: 'mm', placeholder: '150' },
  ],
  CUTS: [
    { label: 'Cutting Distance', unit: 'm', placeholder: '100' },
    { label: 'Roll Tension', unit: 'N', placeholder: '15' },
    { label: 'Travel Speed', unit: 'm/min', placeholder: '20' },
  ],
  SLTS: [
    { label: 'Slit Length', unit: 'm', placeholder: '200' },
    { label: 'Feed Rate', unit: 'm/min', placeholder: '15' },
    { label: 'Upper Rewinding Tension', unit: 'N', placeholder: '10' },
    { label: 'Lower Rewinding Tension', unit: 'N', placeholder: '10' },
    { label: 'Unwinding Tension', unit: 'N', placeholder: '8' },
    { label: 'Disc Blade Distance', unit: 'mm', placeholder: '58.5' },
  ],
  SLTC: [
    { label: 'Slit Length', unit: 'm', placeholder: '200' },
    { label: 'Feed Rate', unit: 'm/min', placeholder: '15' },
    { label: 'Upper Rewinding Tension', unit: 'N', placeholder: '10' },
    { label: 'Lower Rewinding Tension', unit: 'N', placeholder: '10' },
    { label: 'Unwinding Tension', unit: 'N', placeholder: '8' },
    { label: 'Disc Blade Distance', unit: 'mm', placeholder: '58.5' },
  ],
};

const fieldBase = 'w-full h-11 px-3 rounded-lg text-[14px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-[#22c55e] transition-colors';

export default function ProcessStepPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0a]" />}>
      <ProcessStepWizard />
    </Suspense>
  );
}

function ProcessStepWizard() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<StepId>(1);
  const [scannedId, setScannedId] = useState('');
  const [resolvedBatch, setResolvedBatch] = useState<{ id: string; material_id: string; batch_number: string } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedStep, setSelectedStep] = useState<ProcessStep | null>(null);
  const [quantityConsumed, setQuantityConsumed] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Equipment and recipe selection (Fix 2a)
  const [equipmentList, setEquipmentList] = useState<{ id: string; name: string; equipment_code: string }[]>([]);
  const [recipeList, setRecipeList] = useState<{ id: string; recipe_number: string; version: string }[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<{ id: string; name: string; equipment_code: string } | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<{ id: string; recipe_number: string; version: string } | null>(null);

  // Calibration gate state (Fix 2b)
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);

  const { steps: processSteps, loading: stepsLoading } = useProcessRoute(resolvedBatch?.material_id ?? null);

  const requiresCalibration = selectedStep?.requires_calibration ?? false;
  const currentStepLabel = STEP_TITLES[step];
  // TODO: source params from recipe_parameters
  const params = selectedStep ? (PARAMS_BY_CODE[selectedStep.code] ?? []) : [];

  // Visual step number for the progress header (calibration step is conditional)
  const visualStep = requiresCalibration ? step : step <= 2 ? step : step - 1;
  const totalSteps = requiresCalibration ? 5 : 4;

  useEffect(() => {
    const sid = searchParams.get('subbatchId');
    if (sid && step === 1 && !batchLoading && !resolvedBatch) {
      autoLookupById(sid);
    }
  }, [searchParams]);

  // Fetch equipment and recipes when a process step is selected (Fix 2a)
  useEffect(() => {
    if (!selectedStep) return;
    setSelectedEquipment(null);
    setSelectedRecipe(null);
    setCalibrationConfirmed(false);

    supabase
      .from('equipment')
      .select('id, name, equipment_code')
      .eq('process_id', selectedStep.process_id)
      .eq('is_active', true)
      .then(({ data }) => setEquipmentList(data ?? []));

    supabase
      .from('recipes')
      .select('id, recipe_number, version')
      .eq('process_id', selectedStep.process_id)
      .eq('is_active', true)
      .then(({ data }) => setRecipeList(data ?? []));
  }, [selectedStep?.process_id]);

  async function autoLookupById(id: string) {
    setBatchLoading(true);
    setBatchError(null);
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('id, material_id, batch_number')
        .eq('id', id)
        .single();
      
      if (data && !error) {
        setScannedId(data.batch_number);
        setResolvedBatch(data);
        setStep(2);
      } else {
        setBatchError('Provided Sub-batch ID not found.');
      }
    } catch (err) {
      setBatchError('Error looking up sub-batch.');
    } finally {
      setBatchLoading(false);
    }
  }

  function goNext() {
    setStep(prev => {
      if (prev === 2) return (requiresCalibration ? 3 : 4) as StepId;
      if (prev < 6) return (prev + 1) as StepId;
      return prev;
    });
  }
  function goBack() {
    setStep(prev => {
      if (prev === 4 && !requiresCalibration) return 2;
      if (prev > 1) return (prev - 1) as StepId;
      return prev;
    });
  }

  async function handleScanContinue() {
    if (!scannedId.trim()) return;
    setBatchLoading(true);
    setBatchError(null);
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('id, material_id, batch_number')
        .eq('batch_number', scannedId.trim())
        .single();
      
      if (error || !data) {
        setBatchError('Batch not found — check the batch number and try again.');
        return;
      }
      setResolvedBatch(data);
      goNext();
    } catch (err) {
      console.error("Lookup error:", err);
      setBatchError('An unexpected error occurred during lookup.');
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleSubmit() {
    if (!resolvedBatch || !selectedStep || !user) return;
    setSubmitting(true);
    setSubmitError(null);

    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const endTime = now.toTimeString().slice(0, 5);

    // Step A: create the process run first (FK anchor for subsequent inserts)
    const { data: run, error: runError } = await supabase
      .from('process_runs')
      .insert({
        process_id:   selectedStep.process_id,
        operator_id:  user.id,
        equipment_id: selectedEquipment?.id ?? null,  // Fix 2a
        recipe_id:    selectedRecipe?.id ?? null,      // Fix 2a
        start_date:   endDate,
        start_time:   endTime,
        status:       'InProgress',
        recipe_unchanged: true,
      })
      .select('id')
      .single();

    if (runError) { setSubmitError(runError.message); setSubmitting(false); return; }

    // Step B: record the input batch consumed (requires run.id from Step A)
    const { error: inputError } = await supabase
      .from('process_run_inputs')
      .insert({
        process_run_id:    run.id,
        input_batch_id:    resolvedBatch.id,
        quantity_consumed: quantityConsumed ? parseFloat(quantityConsumed) : null,
      });

    if (inputError) { setSubmitError(inputError.message); setSubmitting(false); return; }

    // Step C: write each parameter row (requires run.id from Step A)
    const paramEntries = Object.entries(paramValues).filter(([, v]) => v !== '');
    for (const [key, value] of paramEntries) {
      const { error: paramError } = await supabase
        .from('process_run_parameters')
        .insert({
          process_run_id:          run.id,
          parameter_key:           key,
          parameter_value:         value,
          is_modified_from_recipe: false,
        });
      if (paramError) { setSubmitError(paramError.message); setSubmitting(false); return; }
    }

    // Step D: stamp end_date/end_time and hand off to QC (Fix 2c)
    const { error: closeError } = await supabase
      .from('process_runs')
      .update({ end_date: endDate, end_time: endTime, status: 'AwaitingQC' })
      .eq('id', run.id);

    if (closeError) { setSubmitError(closeError.message); setSubmitting(false); return; }

    // Invalidate the cache for this sub-batch's timeline so it updates instantly
    mutate(['process-timeline', resolvedBatch.id]);

    setSubmitting(false);
    goNext();
  }

  function resetWizard() {
    setStep(1);
    setScannedId('');
    setResolvedBatch(null);
    setBatchError(null);
    setSelectedStep(null);
    setQuantityConsumed('');
    setParamValues({});
    setSubmitError(null);
    setSelectedEquipment(null);
    setSelectedRecipe(null);
    setEquipmentList([]);
    setRecipeList([]);
    setCalibrationConfirmed(false);
  }

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto md:max-w-[640px]">

        {step < 6 && (
          <StepHeader
            step={visualStep}
            total={totalSteps}
            title={currentStepLabel}
            onBack={step > 1 ? goBack : () => router.back()}
          />
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-4">

          {/* Step 1 — Scan */}
          {step === 1 && (
            <>
              <div
                className="w-full rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
                style={{ height: 200, background: '#111', border: '1px solid #1e1e1e' }}
              >
                {!batchLoading && !resolvedBatch ? (
                  <Scanner 
                    onScan={(result) => {
                      if (result && result.length > 0) {
                        setScannedId(result[0].rawValue);
                        setBatchError(null);
                        setResolvedBatch(null);
                      }
                    }}
                    onError={(error) => console.error(error)}
                    components={{
                      torch: false,
                      zoom: false,
                      finder: true,
                    }}
                    styles={{
                      container: { width: '100%', height: '100%' },
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#5a5a5a] gap-3">
                    {batchLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[12px] font-mono uppercase tracking-widest text-[#22c55e]">Looking up...</span>
                      </>
                    ) : (
                      <span className="text-[12px] font-mono uppercase tracking-widest">Done</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#1e1e1e]" />
                <span className="text-[11px] text-[#5a5a5a] font-mono">or enter manually</span>
                <div className="flex-1 h-px bg-[#1e1e1e]" />
              </div>

              <input
                value={scannedId}
                onChange={(e) => { setScannedId(e.target.value); setBatchError(null); setResolvedBatch(null); }}
                placeholder="CTGC-20260601-A01-01"
                className={fieldBase}
              />

              {batchError && (
                <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] px-4 py-3">
                  <div className="text-[12px] text-[#fca5a5]">{batchError}</div>
                </div>
              )}

              {resolvedBatch && (
                <div className="rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.07)] px-4 py-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-1">Found</div>
                  <div className="text-[13px] font-mono text-[#86efac]">{resolvedBatch.batch_number}</div>
                </div>
              )}
            </>
          )}

          {/* Step 2 — Select Process Step (dynamic per material) */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {stepsLoading ? (
                <div className="text-[12px] font-mono text-[#5a5a5a] py-6 text-center">Loading process steps…</div>
              ) : processSteps.length === 0 ? (
                <div className="text-[12px] font-mono text-[#5a5a5a] py-6 text-center">No process steps found for this material.</div>
              ) : processSteps.map((ps) => (
                <button
                  key={ps.process_id}
                  onClick={() => {
                    if (ps.code === 'MIXC' || ps.code === 'MIXE') {
                      router.push(`/log/mixing/${resolvedBatch?.batch_number ?? ''}`);
                      return;
                    }
                    setSelectedStep(ps);
                  }}
                  className={
                    'w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-colors ' +
                    (selectedStep?.process_id === ps.process_id
                      ? 'border-[#22c55e] bg-[rgba(34,197,94,0.08)] text-[#86efac]'
                      : 'border-[#2a2a2a] bg-[#111] text-[#888888] hover:border-[#3a3a3a] hover:text-[#f5f5f5]')
                  }
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-medium">{ps.name}</span>
                    <span className="text-[10px] font-mono text-[#3a3a3a]">{ps.code}</span>
                  </div>
                  {selectedStep?.process_id === ps.process_id && (
                    <span className="w-4 h-4 rounded-full bg-[#22c55e] flex items-center justify-center">
                      <span className="text-[8px] text-black font-bold">✓</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 3 — Calibration Gate (Fix 2b — conditional, shown only when requires_calibration) */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)] px-4 py-4">
                <div className="text-[12px] font-semibold text-[#fcd34d] mb-1">Start-up Calibration Required</div>
                <p className="text-[11.5px] text-[#fcd34d]/80 leading-relaxed">
                  This process step requires calibration before operation. Complete the start-up QC check and confirm below before proceeding.
                </p>
              </div>
              <button
                onClick={() => setCalibrationConfirmed(c => !c)}
                className={
                  'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-colors ' +
                  (calibrationConfirmed
                    ? 'border-[#22c55e] bg-[rgba(34,197,94,0.08)]'
                    : 'border-[#2a2a2a] bg-[#111]')
                }
              >
                <span className={
                  'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ' +
                  (calibrationConfirmed ? 'border-[#22c55e] bg-[#22c55e]' : 'border-[#3a3a3a]')
                }>
                  {calibrationConfirmed && <span className="text-[10px] text-black font-bold">✓</span>}
                </span>
                <span className={
                  'text-[13px] transition-colors ' +
                  (calibrationConfirmed ? 'text-[#86efac]' : 'text-[#888888]')
                }>
                  I confirm start-up calibration has been completed and checked.
                </span>
              </button>
            </div>
          )}

          {/* Step 4 — Parameters (includes equipment + recipe selection) */}
          {step === 4 && (
            <>
              {/* Equipment selection (Fix 2a) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                  Equipment
                </label>
                {equipmentList.length === 0 ? (
                  <div className={fieldBase + ' flex items-center text-[#3a3a3a] cursor-default'}>
                    No equipment configured for this process step
                  </div>
                ) : (
                  <select
                    value={selectedEquipment?.id ?? ''}
                    onChange={e => {
                      const eq = equipmentList.find(m => m.id === e.target.value) ?? null;
                      setSelectedEquipment(eq);
                    }}
                    className={fieldBase}
                  >
                    <option value="">— Select equipment —</option>
                    {equipmentList.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name} ({eq.equipment_code})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Recipe selection (Fix 2a) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                  Recipe <span className="text-[#3a3a3a]">(optional)</span>
                </label>
                {recipeList.length === 0 ? (
                  <div className={fieldBase + ' flex items-center text-[#3a3a3a] cursor-default'}>
                    No active recipes for this process step
                  </div>
                ) : (
                  <select
                    value={selectedRecipe?.id ?? ''}
                    onChange={e => {
                      const rec = recipeList.find(r => r.id === e.target.value) ?? null;
                      setSelectedRecipe(rec);
                    }}
                    className={fieldBase}
                  >
                    <option value="">— No recipe selected —</option>
                    {recipeList.map(r => (
                      <option key={r.id} value={r.id}>{r.recipe_number} v{r.version}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="h-px bg-[#1e1e1e]" />

              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                  Quantity Consumed <span className="text-[#3a3a3a]">(kg / L)</span>
                </label>
                <input
                  type="number"
                  value={quantityConsumed}
                  onChange={(e) => setQuantityConsumed(e.target.value)}
                  placeholder="e.g. 12.5"
                  className={fieldBase}
                />
              </div>
              {params.map((p) => (
                <div key={p.label} className="flex flex-col gap-1.5">
                  <label className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                    {p.label} <span className="text-[#3a3a3a]">({p.unit})</span>
                  </label>
                  <input
                    type="number"
                    value={paramValues[p.label] ?? ''}
                    onChange={(e) => setParamValues((prev) => ({ ...prev, [p.label]: e.target.value }))}
                    placeholder={p.placeholder}
                    className={fieldBase}
                  />
                </div>
              ))}
              {params.length === 0 && (
                <div className="text-[12px] text-[#5a5a5a] font-mono py-2">No additional parameters for this process step.</div>
              )}
            </>
          )}

          {/* Step 5 — Confirm */}
          {step === 5 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-[#2a2a2a] bg-[#111] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#1e1e1e] text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                  Summary
                </div>
                {[
                  ['Sub-Batch', resolvedBatch?.batch_number ?? '—'],
                  ['Process Step', selectedStep?.name ?? '—'],
                  ['Equipment', selectedEquipment ? `${selectedEquipment.name} (${selectedEquipment.equipment_code})` : '—'],
                  ['Recipe', selectedRecipe ? `${selectedRecipe.recipe_number} v${selectedRecipe.version}` : '—'],
                  ['Operator', user?.name ?? '—'],
                  ['Qty Consumed', quantityConsumed ? `${quantityConsumed} kg/L` : '—'],
                  ...Object.entries(paramValues).filter(([, v]) => v !== '').map(([k, v]) => [k, v]),
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-4 py-2.5 border-b border-[#141414] last:border-0">
                    <span className="text-[12px] text-[#888888]">{k}</span>
                    <span className="text-[12px] font-mono text-[#f5f5f5]">{v}</span>
                  </div>
                ))}
              </div>

              {submitError && (
                <div className="rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] px-4 py-3">
                  <p className="text-[11.5px] text-[#fca5a5] leading-relaxed">{submitError}</p>
                </div>
              )}

              <div className="rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)] px-4 py-3">
                <p className="text-[11.5px] text-[#fcd34d] leading-relaxed">
                  Review all values before submitting. This action will be logged to the batch record.
                </p>
              </div>
            </div>
          )}

          {/* Step 6 — Done */}
          {step === 6 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 py-12">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}
              >
                <span className="text-2xl text-[#22c55e]">✓</span>
              </div>
              <div className="text-center">
                <div className="text-[17px] font-semibold text-[#f5f5f5]">Logged Successfully</div>
                <div className="text-[12px] text-[#888888] mt-1">
                  {selectedStep?.name ?? 'Process step'} recorded for{' '}
                  <span className="font-mono text-[#93c5fd]">{resolvedBatch?.batch_number ?? '—'}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => router.back()}
                  className="h-11 px-6 rounded-xl bg-[#22c55e] text-black font-semibold text-[13px] transition-colors"
                >
                  Return to Sub-Batch
                </button>
                <button
                  onClick={resetWizard}
                  className="h-11 px-6 rounded-xl bg-[#161616] border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
                >
                  Log Another
                </button>
              </div>
            </div>
          )}
        </div>

        {step < 6 && (
          <div className="shrink-0 px-5 py-4 border-t border-[#1a1a1a] bg-[#0a0a0a]">
            <button
              onClick={step === 1 ? handleScanContinue : step === 5 ? handleSubmit : goNext}
              disabled={
                (step === 1 && (!scannedId.trim() || batchLoading)) ||
                (step === 2 && !selectedStep) ||
                (step === 3 && !calibrationConfirmed) ||
                (step === 5 && submitting)
              }
              className="w-full h-12 rounded-xl font-semibold text-[15px] text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#22c55e' }}
            >
              {step === 1 && batchLoading
                ? 'Looking up…'
                : step === 5
                ? submitting ? 'Submitting…' : 'Submit Log'
                : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
