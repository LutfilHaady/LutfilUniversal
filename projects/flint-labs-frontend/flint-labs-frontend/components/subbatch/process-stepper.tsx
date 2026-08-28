import type { ProcessStep } from '@/lib/hooks/useProcessRoute'

interface ProcessStepperProps {
  steps: ProcessStep[]
}

export function ProcessStepper({ steps }: ProcessStepperProps) {
  if (steps.length === 0) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4">
        <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Process Route</div>
        <div className="mt-3 text-[12px] text-[#5a5a5a]">No process route defined for this material.</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4">
      <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-4">Process Route</div>
      <div className="flex items-center gap-0">
        {steps.map((step, i) => (
          <div key={step.process_id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors"
                style={{ background: '#0e0e0e', borderColor: '#2a2a2a' }}
              >
                <span className="w-2 h-2 rounded-full bg-[#2a2a2a]" />
              </div>
              <div className="text-center">
                <div className="text-[11.5px] font-medium leading-tight text-[#5a5a5a]">{step.name}</div>
                {step.requires_calibration && (
                  <div className="text-[9px] font-mono text-[#a855f7] uppercase tracking-wider">Cal. req.</div>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 mt-[-20px]" style={{ background: '#1e1e1e' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
