'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { Scanner, setZXingModuleOverrides } from '@yudiel/react-qr-scanner';
import { cameraErrorMessage } from '@/lib/camera-error';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';
import { useProcessRoute, type ProcessStep } from '@/lib/hooks/useProcessRoute';
import { PROCESS_LOG_FIELDS, type ProcessLogFieldDef } from '@/lib/constants';
import { TimerCard } from '@/components/mixing/timer-card';
import { StepHistory } from '@/components/mixing/step-history';
import { useMaterials } from '@/lib/hooks/useMaterials';
import { MixingRatioCalculator } from '@/components/log/mixing-ratio-calculator';
import type { MixingStep, MixRoundStep, AddMaterialStep, MixingStepStatus, MixingStepType, AddMaterialParams, MixRoundParams } from '@/lib/types';

setZXingModuleOverrides({
  locateFile: (path: string) => path.endsWith('.wasm') ? `/${path}` : path,
});

const fieldBase = 'w-full h-11 px-3 rounded-lg text-[14px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-[#22c55e] transition-colors';
const fieldModified = 'w-full h-11 px-3 rounded-lg text-[14px] text-[#fcd34d] bg-[#1a1a1a] border border-[rgba(245,158,11,0.5)] placeholder-[#4a4a4a] outline-none transition-colors';
const labelBase = 'text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]';
const LAST_USED_KEY = 'flint:last-used-run';

interface Equipment { id: string; name: string; equipment_code: string }
interface Recipe { id: string; recipe_number: string; version: string }

interface Props {
  initialBatchId?: string | null;
  initialBatchNumber?: string | null;
  onDone?: () => void;
}

/** Flatten a recipe.params JSONB into `key` / `key[i]` string entries. */
function flattenParams(params: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!params) return out;
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === 'number' || typeof val === 'string') {
      out[key] = String(val);
    } else if (Array.isArray(val)) {
      val.forEach((v, i) => { out[`${key}[${i}]`] = String(v); });
    }
  }
  return out;
}

/** Every parameter key a process step renders (scalars + array cells). */
function renderedParamKeys(fields: ProcessLogFieldDef[] | null): string[] {
  if (!fields) return [];
  const keys: string[] = [];
  for (const f of fields) {
    if (f.kind === 'scalar') keys.push(f.key);
    else for (let i = 0; i < f.count; i++) keys.push(`${f.key}[${i}]`);
  }
  return keys;
}

function readLastUsed(processId: string): { equipmentId?: string; recipeId?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const all = JSON.parse(localStorage.getItem(LAST_USED_KEY) ?? '{}');
    return all?.[processId] ?? null;
  } catch { return null; }
}

function writeLastUsed(processId: string, equipmentId: string | null, recipeId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const all = JSON.parse(localStorage.getItem(LAST_USED_KEY) ?? '{}');
    all[processId] = { equipmentId, recipeId };
    localStorage.setItem(LAST_USED_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function GenericProcessLog({ initialBatchId, initialBatchNumber, onDone }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { materials, loading: materialsLoading } = useMaterials();

  // Section 1 — batch
  const [scannedId, setScannedId] = useState('');
  const [resolvedBatch, setResolvedBatch] = useState<{ id: string; material_id: string; batch_number: string } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);

  // Section 2 — process step
  const [selectedStep, setSelectedStep] = useState<ProcessStep | null>(null);

  // Section 3 — equipment + recipe
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [recipeList, setRecipeList] = useState<Recipe[]>([]);
  const [equipmentLoaded, setEquipmentLoaded] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeDefaults, setRecipeDefaults] = useState<Record<string, string>>({});

  // Section 4 — parameters (non-mixing)
  const [quantityConsumed, setQuantityConsumed] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);
  // Fields the operator has edited since the current recipe was selected — a
  // late-arriving pre-fill must not clobber these (real-floor: operators type
  // before the recipe round-trips).
  const dirtyRef = useRef<Set<string>>(new Set());

  function setParam(key: string, value: string) {
    dirtyRef.current.add(key);
    setParamValues(prev => ({ ...prev, [key]: value }));
  }

  // UTPC multi-batch input
  const [additionalBatches, setAdditionalBatches] = useState<{ id: string; batch_number: string }[]>([]);
  const [additionalBatchInput, setAdditionalBatchInput] = useState('');
  const [additionalBatchLoading, setAdditionalBatchLoading] = useState(false);
  const [additionalBatchError, setAdditionalBatchError] = useState<string | null>(null);

  // Section 4 — mixing mode state (only used when isMixing)
  const [mixingSteps, setMixingSteps] = useState<MixingStep[]>([]);
  const [activeRound, setActiveRound] = useState<MixRoundStep | null>(null);
  const [showMixForm, setShowMixForm] = useState(false);
  const [mixMaterialCode, setMixMaterialCode] = useState('');
  const [mixQty, setMixQty] = useState('');
  const [mixUnit, setMixUnit] = useState<'kg' | 'L' | 'g' | 'mL'>('kg');
  const [mixDuration, setMixDuration] = useState('');
  const [mixTemp, setMixTemp] = useState('');
  const [mixPressure, setMixPressure] = useState('');
  const [mixDispRpm, setMixDispRpm] = useState('');
  const [mixPropRpm, setMixPropRpm] = useState('');
  const [mixStepSubmitting, setMixStepSubmitting] = useState(false);
  const [mixStepError, setMixStepError] = useState<string | null>(null);

  // Collapse-on-complete: which completed section is currently re-opened for edit.
  const [editingSection, setEditingSection] = useState<number | null>(null);

  // Start / success
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const { steps: processSteps, loading: stepsLoading } = useProcessRoute(resolvedBatch?.material_id ?? null);

  const isMixing = selectedStep?.code === 'MIXC' || selectedStep?.code === 'MIXE';
  const isUTPC = selectedStep?.code === 'UTPC';
  const requiresCalibration = selectedStep?.requires_calibration ?? false;
  const processLogFields: ProcessLogFieldDef[] | null = selectedStep
    ? (PROCESS_LOG_FIELDS[selectedStep.code] ?? null)
    : null;
  // Deviation: a field is modified when it differs from a recipe target it was pre-filled with.
  const isModified = (key: string) =>
    recipeDefaults[key] != null && (paramValues[key] ?? '') !== recipeDefaults[key];
  const anyModified = renderedParamKeys(processLogFields).some(isModified);

  // ── Initial auto-lookup (deep links) ──────────────────────────────
  useEffect(() => {
    if (resolvedBatch || batchLoading) return;
    if (initialBatchId) autoLookup({ id: initialBatchId });
    else if (initialBatchNumber) autoLookup({ batch_number: initialBatchNumber });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBatchId, initialBatchNumber]);

  // ── Restore InProgress run when a batch is resolved ─────────────
  useEffect(() => {
    if (!resolvedBatch || !user || started) return;
    let cancelled = false;
    (async () => {
      // Find process_run_inputs pointing to this batch
      const { data: inputs } = await supabase
        .from('process_run_inputs')
        .select('process_run_id')
        .eq('input_batch_id', resolvedBatch.id);
      if (cancelled || !inputs?.length) return;

      const runIds = inputs.map((i: { process_run_id: string }) => i.process_run_id);

      const { data: run } = await supabase
        .from('process_runs')
        .select('id, process_id, equipment_id, recipe_id, process:processes(name, code, sequence_hint, requires_calibration)')
        .eq('operator_id', user.id)
        .eq('status', 'InProgress')
        .in('id', runIds)
        .limit(1)
        .maybeSingle();
      if (cancelled || !run) return;

      const proc = Array.isArray(run.process) ? run.process[0] : run.process;
      if (!proc) return;

      setSelectedStep({
        process_id:          run.process_id,
        name:                proc.name,
        code:                proc.code,
        sequence_hint:       proc.sequence_hint,
        requires_calibration: proc.requires_calibration,
      });

      if (run.equipment_id) {
        const { data: eq } = await supabase
          .from('equipment')
          .select('id, name, equipment_code')
          .eq('id', run.equipment_id)
          .single();
        if (!cancelled && eq) setSelectedEquipment(eq as Equipment);
      }

      if (run.recipe_id) {
        const { data: rec } = await supabase
          .from('recipes')
          .select('id, recipe_number, version')
          .eq('id', run.recipe_id)
          .single();
        if (!cancelled && rec) setSelectedRecipe(rec as Recipe);
      }

      // For mixing: reload existing steps
      if (proc.code === 'MIXC' || proc.code === 'MIXE') {
        const { data: mSteps } = await supabase
          .from('mixing_steps')
          .select('*')
          .eq('batch_id', resolvedBatch.id)
          .order('step_number', { ascending: true });
        if (!cancelled && mSteps) {
          setMixingSteps((mSteps as Record<string, unknown>[]).map(s => ({
            id:         s.id as string,
            type:       s.type as MixingStepType,
            stepNumber: s.step_number as number,
            label:      s.label as string,
            displayRef: s.display_ref as string,
            status:     s.status as MixingStepStatus,
            params:     s.params,
            operator:   s.operator as string,
            timestamp:  s.created_at as string,
          })) as MixingStep[]);
        }
      }

      if (!cancelled) setStarted(true);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedBatch?.id]);

  // ── Fetch equipment + recipes when the process step changes ───────
  useEffect(() => {
    if (!selectedStep) return;
    let cancelled = false;
    setEquipmentLoaded(false);
    setSelectedEquipment(null);
    setSelectedRecipe(null);
    setRecipeDefaults({});
    setParamValues({});
    dirtyRef.current = new Set();
    setCalibrationConfirmed(false);

    const last = readLastUsed(selectedStep.process_id);

    supabase
      .from('equipment')
      .select('id, name, equipment_code')
      .eq('process_id', selectedStep.process_id)
      .eq('is_active', true)
      .then(({ data }) => {
        if (cancelled) return;
        const list = (data ?? []) as Equipment[];
        setEquipmentList(list);
        setEquipmentLoaded(true);
        if (list.length === 1) setSelectedEquipment(list[0]);
        else if (list.length > 1 && last?.equipmentId) {
          setSelectedEquipment(list.find(e => e.id === last.equipmentId) ?? null);
        }
      });

    supabase
      .from('recipes')
      .select('id, recipe_number, version')
      .eq('process_id', selectedStep.process_id)
      .eq('is_active', true)
      .then(({ data }) => {
        if (cancelled) return;
        const list = ([...(data ?? [])] as Recipe[]).sort((a, b) =>
          b.version.localeCompare(a.version, undefined, { numeric: true }));
        setRecipeList(list);
        if (list.length === 1) setSelectedRecipe(list[0]);
        else if (list.length > 1) {
          setSelectedRecipe(
            (last?.recipeId && list.find(r => r.id === last.recipeId)) || list[0]
          );
        }
      });

    return () => { cancelled = true; };
  }, [selectedStep?.process_id]);

  // ── Pre-fill params from the selected recipe ──────────────────────
  useEffect(() => {
    if (!selectedRecipe) { setRecipeDefaults({}); return; }
    let cancelled = false;
    supabase
      .from('recipes')
      .select('params')
      .eq('id', selectedRecipe.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        const defaults = flattenParams((data?.params ?? null) as Record<string, unknown> | null);
        setRecipeDefaults(defaults);
        // Pre-fill the operator form with the recipe targets, but never clobber a
        // field the operator has already edited since this recipe was chosen.
        setParamValues(prev => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(defaults)) {
            if (!dirtyRef.current.has(k)) next[k] = v;
          }
          return next;
        });
      });
    return () => { cancelled = true; };
  }, [selectedRecipe?.id]);

  async function autoLookup(by: { id?: string; batch_number?: string }) {
    setBatchLoading(true);
    setBatchError(null);
    try {
      let q = supabase.from('batches').select('id, material_id, batch_number');
      q = by.id ? q.eq('id', by.id) : q.eq('batch_number', by.batch_number as string);
      const { data, error } = await q.single();
      if (data && !error) {
        setScannedId(data.batch_number);
        setResolvedBatch(data);
        setEditingSection(null);
      } else {
        if (by.batch_number) setScannedId(by.batch_number);
        setBatchError('Batch not found — check the batch number and try again.');
      }
    } catch {
      setBatchError('Error looking up batch.');
    } finally {
      setBatchLoading(false);
    }
  }

  async function resolveBatch() {
    if (!scannedId.trim()) return;
    await autoLookup({ batch_number: scannedId.trim() });
  }

  async function handleAddAdditionalBatch() {
    if (!additionalBatchInput.trim()) return;
    setAdditionalBatchLoading(true);
    setAdditionalBatchError(null);
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_number')
        .eq('batch_number', additionalBatchInput.trim())
        .single();
      if (error || !data) {
        setAdditionalBatchError('Batch not found');
      } else if (data.id === resolvedBatch?.id || additionalBatches.some(b => b.id === data.id)) {
        setAdditionalBatchError('Batch already added');
      } else {
        setAdditionalBatches(prev => [...prev, data]);
        setAdditionalBatchInput('');
      }
    } catch {
      setAdditionalBatchError('Error looking up batch');
    } finally {
      setAdditionalBatchLoading(false);
    }
  }

  // ── Edit / invalidation ───────────────────────────────────────────
  function editBatch() {
    setResolvedBatch(null);
    setSelectedStep(null);
    setSelectedEquipment(null);
    setSelectedRecipe(null);
    setEquipmentList([]);
    setRecipeList([]);
    setRecipeDefaults({});
    setParamValues({});
    dirtyRef.current = new Set();
    setAdditionalBatches([]);
    setStarted(false);
    setMixingSteps([]);
    setActiveRound(null);
    setShowMixForm(false);
    setEditingSection(1);
  }

  function editStep() {
    setSelectedStep(null);
    setSelectedEquipment(null);
    setSelectedRecipe(null);
    setRecipeDefaults({});
    setParamValues({});
    dirtyRef.current = new Set();
    setStarted(false);
    setMixingSteps([]);
    setActiveRound(null);
    setShowMixForm(false);
    setEditingSection(2);
  }

  function pickStep(ps: ProcessStep) {
    setSelectedStep(ps);
    setEditingSection(null);
  }

  // ── Mixing handlers ───────────────────────────────────────────────
  async function handleAddMixingStep() {
    if (!user || !resolvedBatch || !selectedStep) return;
    const mat = materials.find(m => m.code === mixMaterialCode);
    if (!mat || !mixQty.trim()) { setMixStepError('Select a material and enter a quantity.'); return; }

    setMixStepSubmitting(true);
    setMixStepError(null);

    const addMatParams: AddMaterialParams & { recipe_id?: string } = {
      materialCode: mat.code,
      materialName: mat.name,
      quantity: parseFloat(mixQty),
      unit: mixUnit,
      ...(selectedRecipe?.id ? { recipe_id: selectedRecipe.id } : {}),
    };

    const { data: stepRow, error: stepErr } = await supabase.rpc('log_mixing_step', {
      p_batch_id: resolvedBatch.id,
      p_type:     'add_material',
      p_label:    `Add ${mat.name}`,
      p_params:   addMatParams,
      p_operator: user.id,
    });
    if (stepErr || !stepRow || Array.isArray(stepRow)) {
      setMixStepError(stepErr?.message ?? 'Failed to log step.');
      setMixStepSubmitting(false);
      return;
    }

    const addedStep: AddMaterialStep = {
      id:         stepRow.id,
      type:       'add_material',
      stepNumber: stepRow.step_number,
      label:      stepRow.label,
      displayRef: stepRow.display_ref,
      status:     stepRow.status as MixingStepStatus,
      params:     addMatParams,
      operator:   user.name ?? '',
      timestamp:  stepRow.created_at,
    };

    const newSteps: MixingStep[] = [addedStep];

    // Optional mix round
    const mixRoundFilled = mixDuration && mixTemp && mixPressure && mixDispRpm && mixPropRpm;
    if (mixRoundFilled) {
      const roundParams: MixRoundParams = {
        durationMinutes:     parseFloat(mixDuration),
        temperatureCelsius:  parseFloat(mixTemp),
        internalPressureBar: parseFloat(mixPressure),
        dispersionRpm:       parseFloat(mixDispRpm),
        propellerRpm:        parseFloat(mixPropRpm),
      };
      const { data: roundRow } = await supabase.rpc('log_mixing_step', {
        p_batch_id: resolvedBatch.id,
        p_type:     'mix_round',
        p_label:    'Mix Round',
        p_params:   roundParams,
        p_operator: user.id,
      });
      if (roundRow && !Array.isArray(roundRow)) {
        const roundStep: MixRoundStep = {
          id:         roundRow.id,
          type:       'mix_round',
          stepNumber: roundRow.step_number,
          label:      roundRow.label,
          displayRef: roundRow.display_ref,
          status:     roundRow.status as MixingStepStatus,
          params:     roundParams,
          operator:   user.name ?? '',
          timestamp:  roundRow.created_at,
        };
        newSteps.push(roundStep);
        setActiveRound(roundStep);
      }
    }

    setMixingSteps(prev => [...prev, ...newSteps]);

    // Create child batch for the added raw material (used as QC reference after run completes)
    const childBatchNumber = `${resolvedBatch.batch_number}-${mat.suffix || mat.code.replace(/^MT/, '')}`;
    await supabase
      .from('batches')
      .insert({
        batch_number:    childBatchNumber,
        parent_batch_id: resolvedBatch.id,
        material_id:     mat.id,
        status:          'InProgress',
      });

    // Reset add form
    setMixMaterialCode('');
    setMixQty('');
    setMixDuration('');
    setMixTemp('');
    setMixPressure('');
    setMixDispRpm('');
    setMixPropRpm('');
    setShowMixForm(false);
    setMixStepSubmitting(false);
  }

  async function handleMixStepComplete() {
    if (!activeRound?.id) return;
    const { error } = await supabase.rpc('update_mixing_step_status', {
      p_step_id: activeRound.id,
      p_status:  'completed',
    });
    if (!error) {
      setMixingSteps(prev => prev.map(s => s.id === activeRound.id ? { ...s, status: 'completed' as MixingStepStatus } : s));
      setActiveRound(null);
    }
  }

  async function handleMixStepVoid(stepId: string) {
    const { error } = await supabase.rpc('update_mixing_step_status', {
      p_step_id: stepId,
      p_status:  'voided',
    });
    if (!error) {
      setMixingSteps(prev => prev.map(s => s.id === stepId ? { ...s, status: 'voided' as MixingStepStatus } : s));
      if (activeRound?.id === stepId) setActiveRound(null);
    }
  }

  async function handleStart() {
    if (!resolvedBatch || !selectedStep || !user) return;
    setSubmitting(true);
    setSubmitError(null);

    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const startDate = `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}`;
    const startTime = `${p(now.getHours())}:${p(now.getMinutes())}`;

    const recipeUnchanged = !anyModified;

    // Step A — open the run (stays InProgress; completion happens in the drawer).
    const { data: run, error: runError } = await supabase
      .from('process_runs')
      .insert({
        process_id:   selectedStep.process_id,
        operator_id:  user.id,
        equipment_id: selectedEquipment?.id ?? null,
        recipe_id:    selectedRecipe?.id ?? null,
        start_date:   startDate,
        start_time:   startTime,
        status:       'InProgress',
        recipe_unchanged: recipeUnchanged,
      })
      .select('id')
      .single();

    if (runError || !run) { setSubmitError(runError?.message ?? 'Could not start run.'); setSubmitting(false); return; }

    // Step B — input batches consumed.
    const inputsToInsert = [
      { process_run_id: run.id, input_batch_id: resolvedBatch.id, quantity_consumed: !isUTPC && quantityConsumed ? parseFloat(quantityConsumed) : null },
    ];
    if (isUTPC) {
      additionalBatches.forEach(b => inputsToInsert.push({ process_run_id: run.id, input_batch_id: b.id, quantity_consumed: null }));
    }
    const { error: inputError } = await supabase.from('process_run_inputs').insert(inputsToInsert);
    if (inputError) { setSubmitError(inputError.message); setSubmitting(false); return; }

    // Step C — parameters with deviation flags (no-op for mixing since processLogFields is null).
    for (const key of renderedParamKeys(processLogFields)) {
      const value = paramValues[key];
      if (value == null || value === '') continue;
      const { error: paramError } = await supabase
        .from('process_run_parameters')
        .insert({
          process_run_id:          run.id,
          parameter_key:           key,
          parameter_value:         value,
          is_modified_from_recipe: isModified(key),
        });
      if (paramError) { setSubmitError(paramError.message); setSubmitting(false); return; }
    }

    writeLastUsed(selectedStep.process_id, selectedEquipment?.id ?? null, selectedRecipe?.id ?? null);
    mutate(['process-timeline', resolvedBatch.id]);
    if (user?.id) mutate(['active-runs', user.id]);

    setSubmitting(false);
    setStarted(true);
  }

  function resetAll() {
    setScannedId('');
    setResolvedBatch(null);
    setBatchError(null);
    setSelectedStep(null);
    setEquipmentList([]);
    setRecipeList([]);
    setEquipmentLoaded(false);
    setSelectedEquipment(null);
    setSelectedRecipe(null);
    setRecipeDefaults({});
    setQuantityConsumed('');
    setParamValues({});
    dirtyRef.current = new Set();
    setCalibrationConfirmed(false);
    setAdditionalBatches([]);
    setAdditionalBatchInput('');
    setSubmitError(null);
    setStarted(false);
    setEditingSection(null);
    setCameraErrorMsg(null);
    setMixingSteps([]);
    setActiveRound(null);
    setShowMixForm(false);
    setMixMaterialCode('');
    setMixQty('');
    setMixDuration('');
    setMixTemp('');
    setMixPressure('');
    setMixDispRpm('');
    setMixPropRpm('');
    setMixStepError(null);
  }

  const section1Complete = resolvedBatch !== null;
  const section2Complete = section1Complete && selectedStep !== null;
  const section3Complete = section2Complete && equipmentLoaded && (equipmentList.length <= 1 || selectedEquipment !== null);

  const allParamsFilled = renderedParamKeys(processLogFields).every(
    key => paramValues[key] != null && paramValues[key].trim() !== ''
  );

  const doneCount = [section1Complete, section2Complete, section3Complete, started].filter(Boolean).length;
  const startDisabled =
    submitting ||
    !resolvedBatch ||
    !selectedStep ||
    (requiresCalibration && !calibrationConfirmed) ||
    (equipmentList.length > 1 && !selectedEquipment) ||
    (!isMixing && !allParamsFilled);

  // ── Render helpers ────────────────────────────────────────────────
  function SectionHeading({ n, title }: { n: number; title: string }) {
    return (
      <div className="flex items-center gap-2.5">
        <span className="w-5 h-5 rounded-full bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-[10px] font-mono text-[#5a5a5a]">{n}</span>
        <span className="text-[12px] font-semibold text-[#f5f5f5]">{title}</span>
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
        <button data-testid={`edit-section-${n}`} onClick={onEdit} className="text-[11px] text-[#86efac] hover:text-[#bbf7d0] shrink-0">Edit</button>
      </div>
    );
  }

  // For non-mixing: show success screen after run starts.
  if (started && !isMixing) {
    return (
      <div className="flex-1 overflow-y-auto px-5 py-12 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}>
          <span className="text-2xl text-[#22c55e]">▶</span>
        </div>
        <div className="text-center">
          <div className="text-[17px] font-semibold text-[#f5f5f5]">Run started</div>
          <div className="text-[12px] text-[#888888] mt-1">
            {selectedStep?.name ?? 'Process'} is now running for{' '}
            <span className="font-mono text-[#93c5fd]">{resolvedBatch?.batch_number ?? '—'}</span>.
            Use the timer below to complete it.
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={onDone ?? (() => router.back())} className="h-11 px-6 rounded-xl bg-[#22c55e] text-black font-semibold text-[13px]">Return to Batch</button>
          <button onClick={resetAll} className="h-11 px-6 rounded-xl bg-[#161616] border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5]">Log Another</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="shrink-0 px-5 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[#f5f5f5]">Process Log</span>
        <span data-testid="progress-counter" className="text-[11px] font-mono text-[#5a5a5a]">{doneCount} / 4</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

        {/* ── Section 1 — Scan batch ── */}
        {section1Complete && started && editingSection !== 1 ? (
          <CollapsedRow n={1} value={<>Batch — <span className="font-mono text-[#86efac]">{resolvedBatch!.batch_number}</span></>} onEdit={editBatch} />
        ) : (
          <div className="flex flex-col gap-3">
            <SectionHeading n={1} title="Scan batch" />
            <div className="w-full rounded-2xl flex items-center justify-center relative overflow-hidden"
              style={{ height: 180, background: '#111', border: `1px solid ${cameraErrorMsg ? 'rgba(245,158,11,0.3)' : '#1e1e1e'}` }}>
              {cameraErrorMsg ? (
                <div className="flex flex-col items-center gap-2 px-5 text-center">
                  <div className="text-[12.5px] font-semibold text-[#f59e0b]">Camera unavailable</div>
                  <div className="text-[11px] text-[#888888]">{cameraErrorMsg}</div>
                </div>
              ) : (
                <Scanner
                  onScan={(result) => {
                    if (result && result.length > 0) {
                      setScannedId(result[0].rawValue);
                      setBatchError(null);
                      autoLookup({ batch_number: result[0].rawValue });
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
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolveBatch(); } }}
                placeholder="e.g. CTGC-20260601-A01"
                className={fieldBase}
              />
              <button
                data-testid="resolve-batch"
                onClick={resolveBatch}
                disabled={!scannedId.trim() || batchLoading}
                className="px-5 bg-[#22c55e] text-black font-semibold rounded-lg text-[13px] disabled:opacity-40 shrink-0"
              >
                {batchLoading ? '…' : 'Find batch'}
              </button>
            </div>
            {batchError && (
              <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] px-4 py-3 text-[12px] text-[#fca5a5]">{batchError}</div>
            )}
          </div>
        )}

        {/* ── Section 2 — Process step ── */}
        {section1Complete && (
          section2Complete && started && editingSection !== 2 ? (
            <CollapsedRow n={2} value={selectedStep!.name} onEdit={editStep} />
          ) : (
            <div className="flex flex-col gap-2">
              <SectionHeading n={2} title="Process step" />
              {stepsLoading ? (
                <div className="text-[12px] font-mono text-[#5a5a5a] py-4 text-center">Loading process steps…</div>
              ) : processSteps.length === 0 ? (
                <div className="text-[12px] font-mono text-[#5a5a5a] py-4 text-center">No process steps found for this material.</div>
              ) : (
                <select
                  data-testid="process-step-select"
                  value={selectedStep?.process_id ?? ''}
                  onChange={e => {
                    const ps = processSteps.find(s => s.process_id === e.target.value);
                    if (ps) pickStep(ps);
                  }}
                  className={fieldBase}
                >
                  <option value="">— Select process step —</option>
                  {processSteps.map(ps => (
                    <option key={ps.process_id} value={ps.process_id}>{ps.name} ({ps.code})</option>
                  ))}
                </select>
              )}
            </div>
          )
        )}

        {/* ── Section 3 — Equipment & recipe ── */}
        {section2Complete && (
          section3Complete && started && editingSection !== 3 ? (
            <CollapsedRow
              n={3}
              value={<>
                <span data-testid="equipment-value">{selectedEquipment ? `${selectedEquipment.name} (${selectedEquipment.equipment_code})` : 'No equipment'}</span>
                {' · '}
                <span data-testid="recipe-value">{selectedRecipe ? `${selectedRecipe.recipe_number} v${selectedRecipe.version}` : 'No recipe'}</span>
              </>}
              onEdit={() => setEditingSection(3)}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <SectionHeading n={3} title="Equipment & recipe" />
              {/* Equipment */}
              <div className="flex flex-col gap-1.5">
                <label className={labelBase}>Equipment</label>
                {!equipmentLoaded ? (
                  <div className={fieldBase + ' flex items-center text-[#3a3a3a]'}>Loading…</div>
                ) : equipmentList.length === 0 ? (
                  <div className={fieldBase + ' flex items-center text-[#3a3a3a]'}>No equipment configured for this process step</div>
                ) : equipmentList.length === 1 ? (
                  <div data-testid="equipment-value" className={fieldBase + ' flex items-center text-[#f5f5f5]'}>
                    {equipmentList[0].name} ({equipmentList[0].equipment_code})
                  </div>
                ) : (
                  <select
                    data-testid="equipment-select"
                    value={selectedEquipment?.id ?? ''}
                    onChange={e => setSelectedEquipment(equipmentList.find(m => m.id === e.target.value) ?? null)}
                    className={fieldBase}
                  >
                    <option value="">— Select equipment —</option>
                    {equipmentList.map(eq => <option key={eq.id} value={eq.id}>{eq.name} ({eq.equipment_code})</option>)}
                  </select>
                )}
              </div>
              {/* Recipe */}
              <div className="flex flex-col gap-1.5">
                <label className={labelBase}>Recipe <span className="text-[#3a3a3a]">(optional)</span></label>
                {recipeList.length === 0 ? (
                  <div className={fieldBase + ' flex items-center text-[#3a3a3a]'}>No active recipes</div>
                ) : recipeList.length === 1 ? (
                  <div data-testid="recipe-value" className={fieldBase + ' flex items-center text-[#f5f5f5]'}>
                    {recipeList[0].recipe_number} v{recipeList[0].version}
                  </div>
                ) : (
                  <select
                    data-testid="recipe-select"
                    value={selectedRecipe?.id ?? ''}
                    onChange={e => { dirtyRef.current = new Set(); setSelectedRecipe(recipeList.find(r => r.id === e.target.value) ?? null); }}
                    className={fieldBase}
                  >
                    <option value="">— No recipe selected —</option>
                    {recipeList.map(r => <option key={r.id} value={r.id}>{r.recipe_number} v{r.version}</option>)}
                  </select>
                )}
              </div>
              {editingSection === 3 && (
                <button onClick={() => setEditingSection(null)} className="self-start text-[11px] text-[#86efac] hover:text-[#bbf7d0]">Done</button>
              )}
            </div>
          )
        )}

        {/* ── Section 4 — Mixing workspace (MIXC / MIXE) ── */}
        {section2Complete && isMixing && (
          <div className="flex flex-col gap-3">
            <SectionHeading n={4} title="Mixing steps" />

            {!started ? (
              <div className="rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-6 text-center">
                <div className="text-[12px] text-[#5a5a5a]">Start the mixing run below to begin logging steps.</div>
              </div>
            ) : (
              <>
                <MixingRatioCalculator
                  processId={selectedStep.process_id}
                  steps={mixingSteps}
                  className="rounded-xl border border-[#1e1e1e] bg-[#0e0e0e] shrink-0"
                />

                {mixingSteps.length > 0 && (
                  <StepHistory
                    steps={mixingSteps}
                    onVoid={handleMixStepVoid}
                    disabled={!!activeRound}
                  />
                )}

                {activeRound && (
                  <TimerCard
                    step={activeRound}
                    onComplete={handleMixStepComplete}
                    onVoid={() => handleMixStepVoid(activeRound.id!)}
                  />
                )}

                {!activeRound && (
                  showMixForm ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-4">
                      <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#3b82f6]">Add Material</div>
                      <div className="flex flex-col gap-1.5">
                        <label className={labelBase}>Material</label>
                        <select
                          data-testid="mix-material-select"
                          value={mixMaterialCode}
                          onChange={e => setMixMaterialCode(e.target.value)}
                          disabled={materialsLoading}
                          className={fieldBase}
                        >
                          <option value="">{materialsLoading ? 'Loading materials…' : 'Select material…'}</option>
                          {materials.map(m => <option key={m.code} value={m.code}>{m.name} ({m.code})</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className={labelBase}>Quantity</label>
                          <input
                            data-testid="mix-quantity"
                            type="number"
                            min="0"
                            value={mixQty}
                            onChange={e => setMixQty(e.target.value)}
                            placeholder="0.0"
                            className={fieldBase}
                          />
                        </div>
                        <div className="w-24 flex flex-col gap-1.5">
                          <label className={labelBase}>Unit</label>
                          <select
                            value={mixUnit}
                            onChange={e => setMixUnit(e.target.value as 'kg' | 'L' | 'g' | 'mL')}
                            className={fieldBase}
                          >
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="g">g</option>
                            <option value="mL">mL</option>
                          </select>
                        </div>
                      </div>

                      <div className="h-px bg-[#1e1e1e]" />

                      <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#a855f7]">
                        Mix Round <span className="text-[#3a3a3a] normal-case tracking-normal">(optional)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1.5">
                          <label className={labelBase}>Duration (min)</label>
                          <input type="number" min="0" value={mixDuration} onChange={e => setMixDuration(e.target.value)} placeholder="45" className={fieldBase} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className={labelBase}>Temperature (°C)</label>
                          <input type="number" min="0" value={mixTemp} onChange={e => setMixTemp(e.target.value)} placeholder="25" className={fieldBase} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className={labelBase}>Pressure (bar)</label>
                          <input type="number" min="0" value={mixPressure} onChange={e => setMixPressure(e.target.value)} placeholder="1.2" className={fieldBase} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className={labelBase}>Dispersion RPM</label>
                          <input type="number" min="0" value={mixDispRpm} onChange={e => setMixDispRpm(e.target.value)} placeholder="2500" className={fieldBase} />
                        </div>
                        <div className="col-span-2 flex flex-col gap-1.5">
                          <label className={labelBase}>Propeller RPM</label>
                          <input type="number" min="0" value={mixPropRpm} onChange={e => setMixPropRpm(e.target.value)} placeholder="1200" className={fieldBase} />
                        </div>
                      </div>

                      {mixStepError && (
                        <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] px-3 py-2 text-[11.5px] text-[#fca5a5]">{mixStepError}</div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setShowMixForm(false); setMixStepError(null); }}
                          className="flex-1 h-10 rounded-xl border border-[#2a2a2a] text-[#888888] hover:text-[#f5f5f5] text-[13px] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          data-testid="log-mix-step"
                          onClick={handleAddMixingStep}
                          disabled={mixStepSubmitting || !mixMaterialCode || !mixQty.trim()}
                          className="flex-1 h-10 rounded-xl bg-[#22c55e] text-black font-semibold text-[13px] disabled:opacity-40 transition-colors"
                        >
                          {mixStepSubmitting ? 'Logging…' : 'Log Step'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      data-testid="add-mix-step"
                      onClick={() => setShowMixForm(true)}
                      className="w-full h-11 rounded-xl border border-[#2a2a2a] bg-[#111] text-[#888888] hover:text-[#f5f5f5] hover:border-[#3a3a3a] text-[13px] transition-colors"
                    >
                      + Add step
                    </button>
                  )
                )}
              </>
            )}
          </div>
        )}

        {/* ── Section 4 — Parameters / multi-batch (non-mixing) ── */}
        {section2Complete && !isMixing && (
          <div className="flex flex-col gap-3">
            <SectionHeading n={4} title={isUTPC ? 'Input batches & parameters' : 'Parameters'} />

            {requiresCalibration && (
              <>
                <div className="rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)] px-4 py-3">
                  <div className="text-[12px] font-semibold text-[#fcd34d] mb-1">Start-up Calibration Required</div>
                  <p className="text-[11.5px] text-[#fcd34d]/80 leading-relaxed">
                    This process step requires calibration before operation. Complete the start-up QC check and confirm below before starting the run.
                  </p>
                </div>
                <button
                  onClick={() => setCalibrationConfirmed(c => !c)}
                  className={'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ' +
                    (calibrationConfirmed ? 'border-[#22c55e] bg-[rgba(34,197,94,0.08)]' : 'border-[#2a2a2a] bg-[#111]')}
                >
                  <span className={'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ' + (calibrationConfirmed ? 'border-[#22c55e] bg-[#22c55e]' : 'border-[#3a3a3a]')}>
                    {calibrationConfirmed && <span className="text-[10px] text-black font-bold">✓</span>}
                  </span>
                  <span className={'text-[13px] ' + (calibrationConfirmed ? 'text-[#86efac]' : 'text-[#888888]')}>
                    I confirm start-up calibration has been completed and checked.
                  </span>
                </button>
              </>
            )}

            {selectedRecipe && Object.keys(recipeDefaults).length > 0 && (
              <div data-testid="prefill-note" className="rounded-lg border border-[rgba(59,130,246,0.25)] bg-[rgba(59,130,246,0.06)] px-3 py-2 text-[11.5px] text-[#93c5fd]">
                Pre-filled from {selectedRecipe.recipe_number} v{selectedRecipe.version}. Edit any field to override.
              </div>
            )}

            {isUTPC ? (
              <div className="flex flex-col gap-2">
                <label className={labelBase}>Input Batches</label>
                <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                  <span className="text-[13px] font-mono text-[#f5f5f5]">{resolvedBatch?.batch_number}</span>
                  <span className="text-[10px] uppercase text-[#5a5a5a]">Primary</span>
                </div>
                {additionalBatches.map(b => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                    <span className="text-[13px] font-mono text-[#f5f5f5]">{b.batch_number}</span>
                    <button onClick={() => setAdditionalBatches(prev => prev.filter(x => x.id !== b.id))} className="text-[11px] text-[#ef4444] hover:text-[#f87171]">Remove</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    value={additionalBatchInput}
                    onChange={(e) => setAdditionalBatchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAdditionalBatch(); } }}
                    placeholder="Scan/Enter Batch Number"
                    className={fieldBase}
                  />
                  <button onClick={handleAddAdditionalBatch} disabled={additionalBatchLoading || !additionalBatchInput.trim()} className="px-4 bg-[#22c55e] text-black font-semibold rounded-lg text-[13px] disabled:opacity-50 shrink-0">
                    {additionalBatchLoading ? '…' : 'Add'}
                  </button>
                </div>
                {additionalBatchError && <div className="text-[11px] text-[#fca5a5]">{additionalBatchError}</div>}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className={labelBase}>Quantity Consumed <span className="text-[#3a3a3a]">(kg / L)</span></label>
                <input type="number" value={quantityConsumed} onChange={(e) => setQuantityConsumed(e.target.value)} placeholder="e.g. 12.5" className={fieldBase} />
              </div>
            )}

            {/* Per-process structured fields */}
            {processLogFields && processLogFields.map((field) => {
              if (field.kind === 'scalar') {
                const modified = isModified(field.key);
                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label className={labelBase + ' flex items-center gap-1.5 flex-wrap'}>
                      <span>{field.label} <span className="text-[#3a3a3a]">({field.unit})</span></span>
                      {recipeDefaults[field.key] != null && (
                        <span className="text-[#3b82f6] normal-case tracking-normal">target: {recipeDefaults[field.key]}</span>
                      )}
                      {modified && (
                        <span data-testid={`modified-${field.key}`} className="normal-case tracking-normal text-[#f59e0b] bg-[rgba(245,158,11,0.12)] px-1.5 py-0.5 rounded">modified</span>
                      )}
                    </label>
                    <input
                      data-testid={`param-${field.key}`}
                      type="number"
                      value={paramValues[field.key] ?? ''}
                      onChange={(e) => setParam(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={modified ? fieldModified : fieldBase}
                    />
                  </div>
                );
              }
              return (
                <div key={field.key} className="flex flex-col gap-2">
                  <div className={labelBase}>{field.label} <span className="text-[#3a3a3a]">({field.unit})</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    {field.itemLabels.map((il, i) => {
                      const cellKey = `${field.key}[${i}]`;
                      return (
                        <div key={cellKey} className="flex flex-col gap-1">
                          <span className="text-[9.5px] text-[#3a3a3a]">{il}</span>
                          <input
                            data-testid={`param-${field.key}-${i}`}
                            type="number"
                            value={paramValues[cellKey] ?? ''}
                            onChange={(e) => setParam(cellKey, e.target.value)}
                            className={isModified(cellKey) ? fieldModified : fieldBase}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {(!processLogFields || processLogFields.length === 0) && (
              <div className="text-[12px] text-[#5a5a5a] font-mono py-2">No additional parameters for this process step.</div>
            )}
          </div>
        )}

        {/* ── Section 5 — Review ── */}
        {section3Complete && (
          <div className="flex flex-col gap-3">
            <SectionHeading n={5} title="Review & start" />
            <div className="rounded-xl border border-[#2a2a2a] bg-[#111] overflow-hidden">
              {[
                ['Batch', resolvedBatch?.batch_number ?? '—'],
                ...additionalBatches.map((b, i) => [`Input Batch ${i + 2}`, b.batch_number] as [string, string]),
                ['Process Step', selectedStep?.name ?? '—'],
                ['Equipment', selectedEquipment ? `${selectedEquipment.name} (${selectedEquipment.equipment_code})` : '—'],
                ['Recipe', selectedRecipe ? `${selectedRecipe.recipe_number} v${selectedRecipe.version}` : '—'],
                ['Operator', user?.name ?? '—'],
                ...(!isUTPC && !isMixing ? [['Qty Consumed', quantityConsumed ? `${quantityConsumed} kg/L` : '—'] as [string, string]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-2.5 border-b border-[#141414] last:border-0">
                  <span className="text-[12px] text-[#888888]">{k}</span>
                  <span className="text-[12px] font-mono text-[#f5f5f5]">{v}</span>
                </div>
              ))}
            </div>
            {anyModified && (
              <div className="rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)] px-3 py-2 text-[11.5px] text-[#fcd34d]">
                Some values deviate from the recipe — this run will be flagged as modified.
              </div>
            )}
            {isMixing && started && (
              <div className="rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] px-3 py-2 text-[11.5px] text-[#86efac]">
                Mixing run is active. Use the section above to log steps. Complete the run via the timer bar at the bottom.
              </div>
            )}
          </div>
        )}

        {submitError && (
          <div className="rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] px-4 py-3 text-[11.5px] text-[#fca5a5]">{submitError}</div>
        )}
      </div>

      {resolvedBatch && selectedStep && !(isMixing && started) && (
        <div className="shrink-0 px-5 py-4 border-t border-[#1a1a1a] bg-[#0a0a0a]">
          <button
            data-testid="start-run"
            onClick={handleStart}
            disabled={startDisabled}
            className="w-full h-12 rounded-xl font-semibold text-[15px] text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#22c55e' }}
          >
            {submitting ? 'Starting…' : isMixing ? 'Start mixing' : 'Start run'}
          </button>
        </div>
      )}
    </>
  );
}
