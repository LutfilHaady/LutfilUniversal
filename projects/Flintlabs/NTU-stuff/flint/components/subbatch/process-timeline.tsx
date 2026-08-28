'use client';

import { useState } from 'react';
import { TIMELINE } from '@/lib/data';
import { IconChevronDown, IconChevronRight, IconActivity, IconCheck } from '@/components/icons';

export function ProcessTimeline() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['t3']));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Process Timeline</span>
        <span className="text-[10.5px] font-mono text-[#888888]">{TIMELINE.length} entries</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-[#1a1a1a]">
        {TIMELINE.map((entry) => {
          const isOpen = expanded.has(entry.id);
          const isProcess = entry.type === 'process';

          return (
            <div key={entry.id}>
              {/* Entry header */}
              <button
                onClick={() => toggle(entry.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#141414] transition-colors text-left"
              >
                {/* Icon */}
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: isProcess
                      ? entry.isLive
                        ? 'rgba(59,130,246,0.15)'
                        : 'rgba(34,197,94,0.12)'
                      : 'rgba(245,158,11,0.12)',
                    border: isProcess
                      ? entry.isLive
                        ? '1px solid rgba(59,130,246,0.35)'
                        : '1px solid rgba(34,197,94,0.25)'
                      : '1px solid rgba(245,158,11,0.25)',
                  }}
                >
                  {isProcess ? (
                    entry.isLive ? (
                      <IconActivity size={13} className="text-[#93c5fd]" />
                    ) : (
                      <IconCheck size={13} className="text-[#86efac]" />
                    )
                  ) : (
                    <span className="text-[10px] font-bold text-[#fcd34d]">QC</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium text-[#f5f5f5]">{entry.step}</span>
                    {entry.isLive && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[#93c5fd] bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.3)] px-1.5 py-0.5 rounded">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[#888888]">{entry.operator}</span>
                    <span className="text-[#3a3a3a]">·</span>
                    <span className="text-[11px] font-mono text-[#5a5a5a]">{entry.ts}</span>
                  </div>
                </div>

                {/* Chevron */}
                {isOpen
                  ? <IconChevronDown size={14} className="text-[#5a5a5a] shrink-0" />
                  : <IconChevronRight size={14} className="text-[#5a5a5a] shrink-0" />}
              </button>

              {/* Expanded params */}
              {isOpen && (
                <div className="px-5 pb-3 ml-10">
                  <div className="rounded-lg border border-[#1e1e1e] bg-[#0e0e0e] overflow-hidden">
                    <table className="w-full">
                      <tbody className="divide-y divide-[#141414]">
                        {entry.params.map((p) => (
                          <tr key={p.k}>
                            <td className="px-3 py-1.5 text-[11px] text-[#5a5a5a] font-mono w-1/2">{p.k}</td>
                            <td className="px-3 py-1.5 text-[11px] text-[#f5f5f5] font-mono">{p.v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
