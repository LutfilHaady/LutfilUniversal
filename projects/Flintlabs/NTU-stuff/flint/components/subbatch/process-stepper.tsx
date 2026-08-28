import { PROCESS_ROUTE } from '@/lib/data';
import { IconCheck } from '@/components/icons';

export function ProcessStepper() {
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4">
      <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-4">Process Route</div>
      <div className="flex items-center gap-0">
        {PROCESS_ROUTE.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1 min-w-0">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors"
                style={{
                  background:
                    step.status === 'completed'
                      ? 'rgba(34,197,94,0.15)'
                      : step.status === 'active'
                      ? 'rgba(59,130,246,0.15)'
                      : '#0e0e0e',
                  borderColor:
                    step.status === 'completed'
                      ? '#22c55e'
                      : step.status === 'active'
                      ? '#3b82f6'
                      : '#2a2a2a',
                }}
              >
                {step.status === 'completed' ? (
                  <IconCheck size={14} className="text-[#22c55e]" />
                ) : step.status === 'active' ? (
                  <span className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[#2a2a2a]" />
                )}
              </div>
              <div className="text-center">
                <div
                  className="text-[11.5px] font-medium leading-tight"
                  style={{
                    color:
                      step.status === 'completed'
                        ? '#22c55e'
                        : step.status === 'active'
                        ? '#93c5fd'
                        : '#5a5a5a',
                  }}
                >
                  {step.label}
                </div>
                {step.ts && (
                  <div className="text-[10px] font-mono text-[#5a5a5a]">{step.ts}</div>
                )}
                {step.qc && (
                  <div className="text-[9px] font-mono text-[#22c55e] uppercase tracking-wider">
                    QC {step.qc}
                  </div>
                )}
              </div>
            </div>

            {/* Connector line */}
            {i < PROCESS_ROUTE.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-2 mt-[-20px]"
                style={{
                  background:
                    step.status === 'completed'
                      ? 'rgba(34,197,94,0.4)'
                      : '#1e1e1e',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
