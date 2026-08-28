'use client';

import { useState } from 'react';
import supabase from '@/lib/supabase';
import type { MixingStep, MixingStepStatus } from '@/lib/types';
import { AddStepModal } from './add-step-modal';
import { IconPlus, IconCheck, IconActivity, IconClose } from '@/components/icons';

const STATUS_TONE: Record<MixingStepStatus, { label: string; fg: string; bg: string; border: string }> = {
  in_progress: { label: 'In Progress', fg: '#93c5fd', bg: 'rgba(59,130,246,.12)',  border: 'rgba(59,130,246,.35)' },
  completed:   { label: 'Completed',   fg: '#86efac', bg: 'rgba(34,197,94,.12)',   border: 'rgba(34,197,94,.35)'  },
  voided:      { label: 'Voided',      fg: '#5a5a5a', bg: 'rgba(90,90,90,.12)',    border: 'rgba(90,90,90,.35)'   },
};

interface Props {
  batchId:       string;         // UUID — passed to modal for RPC calls
  parentBatchId: string;         // batch_number — for display and displayRef building
  initialSteps:  MixingStep[];
  canAddSteps:   boolean;
}

export function MixingStepsPanel({ batchId, parentBatchId, initialSteps, canAddSteps }: Props) {
  const [steps, setSteps]               = useState<MixingStep[]>(initialSteps);
  const [showModal, setShowModal]       = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);
  const [pendingStepId, setPendingStepId] = useState<string | null>(null);

  const nextStepNumber = steps.length > 0 ? Math.max(...steps.map((s) => s.stepNumber)) + 1 : 1;

  function handleAddStep(newStep: MixingStep) {
    setSteps((prev) => [...prev, newStep]);
    setShowModal(false);
  }

  async function updateStepStatus(stepId: string, status: 'completed' | 'voided') {
    if (pendingStepId) return;
    setActionError(null);
    setPendingStepId(stepId);
    try {
      const { error } = await supabase.rpc('update_mixing_step_status', {
        p_step_id: stepId,
        p_status:  status,
      });
      if (error) {
        setActionError(error.message);
        return;
      }
      setSteps((prev) =>
        prev.map((s) => s.id === stepId ? { ...s, status: status as MixingStepStatus } : s)
      );
    } finally {
      setPendingStepId(null);
    }
  }

  const activeCount = steps.filter((s) => s.status !== 'voided').length;

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Mixing Steps</span>
        <div className="flex items-center gap-3">
          <span className="text-[10.5px] font-mono text-[#888888]">{activeCount} step{activeCount !== 1 ? 's' : ''}</span>
          {canAddSteps && (
            <button
              onClick={() => setShowModal(true)}
              className="h-7 px-3 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              <IconPlus size={11} /> Add Step
            </button>
          )}
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="px-5 py-2 text-[11.5px] text-[#f87171] border-b border-[#1a1a1a]">
          {actionError}
        </div>
      )}

      {/* Step list */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1a1a1a]">
        {steps.length === 0 && (
          <div className="px-5 py-8 text-center text-[12px] text-[#5a5a5a]">
            No steps logged yet. Add the first step to begin tracing this mixing run.
          </div>
        )}
        {steps.map((step) => {
          const tone    = STATUS_TONE[step.status];
          const summary = step.type === 'add_material'
            ? `${step.params.quantity} ${step.params.unit}`
            : `${step.params.durationMinutes} min · ${step.params.dispersionRpm} RPM`;

          return (
            <div
              key={step.stepNumber}
              className={`px-5 py-3 flex items-start gap-3 ${step.status === 'voided' ? 'opacity-40' : ''}`}
            >
              {/* Icon badge */}
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
              >
                {step.status === 'completed'   && <IconCheck    size={12} style={{ color: tone.fg }} />}
                {step.status === 'in_progress' && <IconActivity size={12} style={{ color: tone.fg }} />}
                {step.status === 'voided'      && <IconClose    size={12} style={{ color: tone.fg }} />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12.5px] font-medium text-[#f5f5f5]">{step.label}</span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ color: tone.fg, background: tone.bg, border: `1px solid ${tone.border}` }}
                  >
                    {tone.label}
                  </span>
                  <span className="text-[10.5px] font-mono text-[#5a5a5a]">
                    Step {String(step.stepNumber).padStart(2, '0')}
                  </span>
                </div>
                <div className="text-[11px] text-[#888888] mt-0.5">{summary}</div>
                <div className="text-[10.5px] font-mono text-[#5a5a5a] mt-1 truncate">{step.displayRef}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10.5px] text-[#5a5a5a]">{step.operator}</span>
                  <span className="text-[#2a2a2a]">·</span>
                  <span className="text-[10.5px] font-mono text-[#5a5a5a]">{step.timestamp}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="shrink-0 flex flex-col gap-1 pt-0.5">
                {step.status === 'in_progress' && (
                  <button
                    onClick={() => { if (step.id) updateStepStatus(step.id, 'completed'); }}
                    disabled={pendingStepId === step.id}
                    className="text-[10.5px] text-[#22c55e] hover:text-emerald-400 disabled:opacity-40 font-mono transition-colors whitespace-nowrap"
                  >
                    {pendingStepId === step.id ? '…' : 'Mark Complete'}
                  </button>
                )}
                {step.status !== 'voided' && (
                  <button
                    onClick={() => { if (step.id) updateStepStatus(step.id, 'voided'); }}
                    disabled={pendingStepId === step.id}
                    className="text-[10.5px] text-[#5a5a5a] hover:text-[#888888] disabled:opacity-40 font-mono transition-colors"
                  >
                    Void
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <AddStepModal
          batchId={batchId}
          parentBatchId={parentBatchId}
          nextStepNumber={nextStepNumber}
          onSubmit={handleAddStep}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
