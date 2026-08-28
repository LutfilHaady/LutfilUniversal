'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IconChevronLeft } from '@/components/icons';
import { TimerCard } from '@/components/mixing/timer-card';
import { StepHistory } from '@/components/mixing/step-history';
import { AddStepModal } from '@/components/subbatch/add-step-modal';
import type {
  MixingStep,
  MixRoundStep,
  AddMaterialParams,
  MixRoundParams,
  MixingStepStatus,
} from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
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
  return { ...base, type: 'mix_round', params: row.params as unknown as MixRoundParams };
}

export function MixingOperatorPage({ batchId }: Props) {
  const router   = useRouter();
  const { user } = useAuth();

  const [steps, setSteps]             = useState<MixingStep[]>([]);
  const [batchUuid, setBatchUuid]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
        .select('id')
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
      await fetchSteps(uuid);
      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

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

  async function handleAddStep(incoming: Omit<MixingStep, 'stepNumber' | 'displayRef'>) {
    if (!batchUuid || !user) return;
    setSubmitting(true);
    setActionError(null);

    const { error } = await supabase.rpc('log_mixing_step', {
      p_batch_id: batchUuid,
      p_type: incoming.type,
      p_label: incoming.label,
      p_params: incoming.params,
      p_operator: user.id,
    });

    if (error) {
      setActionError(error.message);
    } else {
      await fetchSteps(batchUuid);
      setShowAddStep(false);
    }
    setSubmitting(false);
  }

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto md:max-w-[640px]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1a1a] shrink-0">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#f5f5f5] hover:bg-[#161616] transition-colors"
          >
            <IconChevronLeft size={22} />
          </button>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Mixing Log</div>
            <div className="text-[15px] font-semibold text-[#f5f5f5] font-mono">{batchId}</div>
          </div>
        </div>

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
      </div>

      {showAddStep && (
        <AddStepModal
          mode="sheet"
          batchId={batchUuid!}
          parentBatchId={batchId}
          nextStepNumber={steps.filter((s) => s.status !== 'voided').length + 1}
          onSubmit={handleAddStep}
          onClose={() => setShowAddStep(false)}
        />
      )}
    </div>
  );
}
