'use client';

import { useState, useEffect } from 'react';
import { TimerCard } from '@/components/mixing/timer-card';
import { StepHistory } from '@/components/mixing/step-history';
import { AddStepModal } from '@/components/subbatch/add-step-modal';
import { MixingRatioCalculator } from '@/components/log/mixing-ratio-calculator';
import { computePlan, toRatioRows, type PlanRow } from '@/lib/mixing/ratio-plan';
import type {
  MixingStep,
  MixRoundStep,
  AddMaterialParams,
  MixRoundParams,
  QcCheckParams,
  MixingStepStatus,
} from '@/lib/types';
import supabase from '@/lib/supabase';

interface Props {
  batchId: string;
}

interface DbMixingStep {
  id: string;
  batch_id: string;
  step_number: number;
  type: string;
  label: string;
  display_ref: string;
  status: string;
  params: Record<string, unknown>;
  operator: string;
  created_at: string;
  completed_at: string | null;
}

function mapDbStep(row: DbMixingStep): MixingStep {
  const base = {
    id: row.id,
    stepNumber: row.step_number,
    label: row.label,
    displayRef: row.display_ref,
    status: row.status as MixingStepStatus,
    operator: row.operator,
    timestamp: row.created_at,
  };
  if (row.type === 'add_material') {
    return { ...base, type: 'add_material', params: row.params as unknown as AddMaterialParams };
  }
  if (row.type === 'qc_check') {
    return { ...base, type: 'qc_check', params: row.params as unknown as QcCheckParams };
  }
  return { ...base, type: 'mix_round', params: row.params as unknown as MixRoundParams };
}

export function MixingWorkspace({ batchId }: Props) {
  const [steps, setSteps]             = useState<MixingStep[]>([]);
  const [batchUuid, setBatchUuid]     = useState<string | null>(null);
  const [parentMaterialId, setParentMaterialId] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processId, setProcessId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<{ id: string; recipe_number: string }[]>([]);

  async function fetchSteps(uuid: string) {
    const { data: rows, error } = await supabase
      .from('mixing_steps')
      .select('*')
      .eq('batch_id', uuid)
      .order('step_number', { ascending: true });

    if (error) {
      console.error('Failed to fetch mixing steps', error);
    } else if (rows) {
      setSteps((rows as DbMixingStep[]).map(mapDbStep));
    }
  }


  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);

      const { data: batch, error } = await supabase
        .from('batches')
        .select('id, material_id')
        .eq('batch_number', batchId)
        .single();

      if (cancelled) return;

      if (error || !batch) {
        console.error('Batch not found', error);
        setLoading(false);
        return;
      }

      const uuid = (batch as { id: string }).id;
      setBatchUuid(uuid);
      setParentMaterialId((batch as { material_id: string }).material_id);

      const code = batchId.slice(0, 4);
      const { data: proc } = await supabase
        .from('processes')
        .select('id')
        .eq('code', code)
        .single();
      if (!cancelled && proc) setProcessId((proc as { id: string }).id);

      await fetchSteps(uuid);

      if (!cancelled) {
        setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // Rebuild the ratio plan whenever steps change.
  useEffect(() => {
    if (!batchUuid || !processId) return;
    const firstAdd = steps.find(s => s.type === 'add_material' && s.status !== 'voided') as
      | (MixingStep & { params: AddMaterialParams & { recipe_id?: string } }) | undefined;
    if (!firstAdd) { setPlan([]); setRecipeId(null); return; }
    let cancelled = false;
    (async () => {
      let rid = (firstAdd.params as AddMaterialParams & { recipe_id?: string }).recipe_id ?? null;
      if (!rid) {
        const { data } = await supabase.from('recipes').select('id')
          .eq('process_id', processId).eq('is_active', true);
        if (data && data.length === 1) rid = (data[0] as { id: string }).id;
      }
      if (!rid) { if (!cancelled) { setPlan([]); setRecipeId(null); } return; }
      const { data: rec } = await supabase.from('recipes').select('params').eq('id', rid).single();
      const rows = toRatioRows((rec?.params ?? null) as Record<string, unknown> | null);
      const anchorMat = (firstAdd.params as AddMaterialParams).materialCode;
      const anchorAmt = (firstAdd.params as AddMaterialParams).quantity;
      if (!cancelled) { setRecipeId(rid); setPlan(computePlan(rows, anchorMat, anchorAmt)); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, batchUuid, processId]);

  // Fetch active recipes for processId (for the RecipePicker on first material).
  useEffect(() => {
    if (!processId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('recipes').select('id, recipe_number')
        .eq('process_id', processId).eq('is_active', true);
      if (!cancelled && data) {
        const recs = data as { id: string; recipe_number: string }[];
        setRecipes(recs);
        if (recs.length === 1) setRecipeId(recs[0].id);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  // Derive next suggestion from the plan.
  const addedCodes = new Set(
    steps.filter(s => s.type === 'add_material' && s.status !== 'voided')
         .map(s => (s.params as AddMaterialParams).materialCode),
  );
  const nextPlanRow = plan.find(p => !addedCodes.has(p.material)) ?? null;
  const isFirstMaterial = steps.every(s => s.type !== 'add_material' || s.status === 'voided');

  const activeRound = steps.find(
    (s): s is MixRoundStep => s.type === 'mix_round' && s.status === 'in_progress',
  ) ?? null;

  const canAddStep = !loading && !submitting && batchUuid !== null && activeRound === null;

  async function handleComplete() {
    if (!activeRound?.id || !batchUuid) return;
    setSubmitting(true);
    setActionError(null);

    const { error } = await supabase.rpc('update_mixing_step_status', {
      p_step_id: activeRound.id,
      p_status: 'completed',
    });

    if (error) {
      setActionError(error.message);
    } else {
      await fetchSteps(batchUuid);
    }
    setSubmitting(false);
  }

  async function handleVoid(stepId: string) {
    if (!batchUuid) return;
    setSubmitting(true);
    setActionError(null);

    const { error } = await supabase.rpc('update_mixing_step_status', {
      p_step_id: stepId,
      p_status: 'voided',
    });

    if (error) {
      setActionError(error.message);
    } else {
      await fetchSteps(batchUuid);
    }
    setSubmitting(false);
  }

  async function handleAddStep(incoming: MixingStep[]) {
    if (!batchUuid || incoming.length === 0) return;
    setSubmitting(true);
    setActionError(null);

    for (const step of incoming) {
      if (step.type === 'add_material') {
        const matParams = step.params as AddMaterialParams;
        const childBatchNumber = `${batchId}-${matParams.materialCode.replace(/^MT/, '')}`;

        const { data: newChild, error: childErr } = await supabase
          .from('batches')
          .insert({
            batch_number:      childBatchNumber,
            parent_batch_id:   batchUuid,
            material_id:       parentMaterialId,
            status:            'InProgress',
            current_quantity:  matParams.quantity,
            original_quantity: matParams.quantity,
            unit:              matParams.unit,
          })
          .select('id, batch_number')
          .single();

        if (childErr || !newChild) {
          setActionError(childErr?.message ?? 'Failed to create mixing sub-batch');
        }
      }
    }

    await fetchSteps(batchUuid);
    setShowAddStep(false);
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <MixingRatioCalculator processId={processId} steps={steps} />

      {/* Error banner */}
      {actionError && (
        <div className="mx-5 mt-3 px-4 py-2.5 rounded-lg bg-[rgba(239,68,68,.12)] border border-[rgba(239,68,68,.3)] text-[12px] text-[#fca5a5] font-mono shrink-0">
          {actionError}
        </div>
      )}

      {/* Zone 1: Active timer card */}
      {activeRound && (
        <div className="shrink-0">
          <TimerCard
            step={activeRound}
            onComplete={handleComplete}
            onVoid={handleVoid}
            disabled={submitting}
          />
        </div>
      )}

      {/* Zone 2: Step history */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[12px] text-[#5a5a5a]">Loading…</div>
        ) : (
          <StepHistory steps={steps} onVoid={handleVoid} disabled={submitting} />
        )}
      </div>

      {/* Recipe picker — shown before any material has been added */}
      {isFirstMaterial && recipes.length > 0 && (
        <div className="mx-5 mt-3 flex flex-col gap-1">
          <label className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">Recipe (for ratio carry-over)</label>
          <select
            value={recipeId ?? ''}
            onChange={(e) => setRecipeId(e.target.value || null)}
            className="w-full h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] text-[12.5px] text-[#f5f5f5] font-mono focus:outline-none focus:border-[#3b82f6]"
          >
            <option value="">Select recipe...</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>{r.recipe_number}</option>
            ))}
          </select>
        </div>
      )}

      {/* Zone 3: Add Step CTA */}
      <div className="shrink-0 px-5 py-4 border-t border-[#1a1a1a] bg-[#0a0a0a]">
        <button
          onClick={() => setShowAddStep(true)}
          disabled={!canAddStep}
          className={
            `w-full h-12 rounded-xl font-semibold text-[15px] transition-colors` +
            (canAddStep
              ? ' bg-[#22c55e] text-black hover:bg-emerald-400'
              : ' bg-[#161616] border border-[#2a2a2a] text-[#888888] opacity-40 cursor-not-allowed')
          }
        >
          + Add Step
        </button>
        {!canAddStep && activeRound && (
          <p className="text-center text-[11px] text-[#5a5a5a] mt-2">
            Complete the active mix round before adding a step
          </p>
        )}
      </div>

      {showAddStep && (
        <AddStepModal
          mode="sheet"
          batchId={batchUuid!}
          parentBatchId={batchId}
          nextStepNumber={steps.filter((s) => s.status !== 'voided').length + 1}
          suggestedMaterial={nextPlanRow?.material}
          suggestedQuantity={nextPlanRow?.targetKg}
          recipeId={isFirstMaterial ? recipeId : null}
          processId={processId}
          onSubmit={handleAddStep}
          onClose={() => setShowAddStep(false)}
        />
      )}
    </div>
  );
}
