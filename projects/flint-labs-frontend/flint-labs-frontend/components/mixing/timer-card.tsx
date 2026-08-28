'use client';

import { useEffect, useState } from 'react';
import type { MixRoundStep } from '@/lib/types';

interface Props {
  step: MixRoundStep;
  onComplete: () => void;
  onVoid: (stepId: string) => void;
  disabled?: boolean;
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerCard({ step, onComplete, onVoid, disabled }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startMs = new Date(step.timestamp).getTime();
    const tick = () => setElapsedMs(Date.now() - startMs);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step.timestamp]);

  const targetMs = step.params.durationMinutes * 60 * 1000;
  const progress  = Math.min(elapsedMs / targetMs, 1);
  const overrun   = elapsedMs > targetMs;
  const overrunMs = elapsedMs - targetMs;

  return (
    <div className="mx-5 mt-4 rounded-2xl border border-[#2a2a2a] bg-[#111] p-5 flex flex-col gap-4">
      <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
        Mix Round · Step {String(step.stepNumber).padStart(2, '0')}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[36px] font-mono font-semibold leading-none text-[#f5f5f5]">
            {formatMs(elapsedMs)}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] mt-1">Elapsed</div>
        </div>
        <div className="text-[#3a3a3a] text-[20px] font-mono mb-4">/</div>
        <div className="text-right">
          <div className="text-[36px] font-mono font-semibold leading-none" style={{ color: overrun ? '#f59e0b' : '#22c55e' }}>
            {overrun ? '00:00' : formatMs(targetMs - elapsedMs)}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] mt-1">Remaining</div>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-[#1e1e1e] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width:      `${progress * 100}%`,
            background: overrun ? '#f59e0b' : '#22c55e',
          }}
        />
      </div>

      {overrun && (
        <div className="text-[11.5px] font-mono" style={{ color: '#f59e0b' }}>
          ⚠ +{formatMs(overrunMs)} overrun
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onComplete}
          disabled={disabled}
          className="flex-1 h-11 rounded-xl font-semibold text-[14px] text-black bg-[#22c55e] hover:bg-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Mark Complete
        </button>
        <button
          onClick={() => step.id && onVoid(step.id)}
          disabled={disabled || !step.id}
          className="h-11 px-4 rounded-xl font-semibold text-[13px] border border-[#2a2a2a] text-[#888888] hover:border-[#ef4444] hover:text-[#fca5a5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Void
        </button>
      </div>
    </div>
  );
}
