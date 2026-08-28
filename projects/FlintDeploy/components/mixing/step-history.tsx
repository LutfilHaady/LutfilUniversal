'use client';

import type { MixingStep, MixingStepStatus } from '@/lib/types';

interface Props {
  steps: MixingStep[];
  onVoid?: (stepId: string) => void;
  disabled?: boolean;
}

function stepSummary(step: MixingStep): string {
  if (step.type === 'add_material') {
    return `${step.params.materialName}  ${step.params.quantity} ${step.params.unit}`;
  }
  if (step.type === 'qc_check') {
    const checks = (step.params as { checks?: Array<{ passed: boolean }> }).checks;
    return checks ? `${checks.length} checks` : 'QC';
  }
  return `${step.params.durationMinutes} min`;
}

const STATUS_DOT: Record<MixingStepStatus, string> = {
  completed: 'bg-[#22c55e]',
  in_progress: 'bg-[#3b82f6]',
  voided: 'bg-[#3a3a3a]',
};

const STATUS_LABEL: Record<MixingStepStatus, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  voided: 'Voided',
};

export function StepHistory({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[12px] text-[#5a5a5a]">
        No steps logged yet
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {steps.map((step) => {
        const voided = step.status === 'voided';
        return (
          <div
            key={step.stepNumber}
            className={`flex items-center gap-3 px-5 py-3.5 border-b border-[#1a1a1a] ${voided ? 'opacity-40' : ''}`}
          >
            <span className="text-[11px] font-mono text-[#5a5a5a] w-6 shrink-0">
              {String(step.stepNumber).padStart(2, '0')}
            </span>

            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-medium ${voided ? 'line-through text-[#5a5a5a]' : 'text-[#f5f5f5]'}`}>
                {step.type === 'add_material' ? 'Add Material' : step.type === 'qc_check' ? 'QC Check' : 'Mix Round'}
              </div>
              <div className="text-[11px] font-mono text-[#888888] mt-0.5 truncate">
                {stepSummary(step)}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[step.status]}`} />
              <span className="text-[11px] text-[#5a5a5a]">{STATUS_LABEL[step.status]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
