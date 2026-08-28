'use client';

import { useState } from 'react';
import { useProcessTimeline } from '@/lib/hooks/useProcessTimeline';
import { DataState } from '@/components/data-state';
import { IconChevronDown, IconChevronRight, IconActivity, IconCheck } from '@/components/icons';
import type { ProcessRunTimeline } from '@/lib/types';

interface ProcessTimelineProps {
  subBatchId: string;
}

export function ProcessTimeline({ subBatchId }: ProcessTimelineProps) {
  const { timeline, loading, error } = useProcessTimeline(subBatchId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * Format timestamp to Singapore timezone.
   */
  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('en-SG', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Singapore',
    });
    return formatter.format(date);
  }

  /**
   * Check if a process run is "live" (completed_at is null and status is InProgress).
   */
  function isLive(entry: ProcessRunTimeline): boolean {
    return entry.type === 'process' && !entry.completed_at && entry.status === 'InProgress';
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Process Timeline</span>
        <span className="text-[10.5px] font-mono text-[#888888]">{timeline.length} entries</span>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={timeline.length === 0}
        emptyMessage="No process runs yet"
      >
        <div className="flex-1 overflow-y-auto divide-y divide-[#1a1a1a]">
          {timeline.map((entry) => {
            const isOpen = expanded.has(entry.id);
            const isProcess = entry.type === 'process';
            const live = isLive(entry);

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
                        ? live
                          ? 'rgba(59,130,246,0.15)'
                          : 'rgba(34,197,94,0.12)'
                        : 'rgba(245,158,11,0.12)',
                      border: isProcess
                        ? live
                          ? '1px solid rgba(59,130,246,0.35)'
                          : '1px solid rgba(34,197,94,0.25)'
                        : '1px solid rgba(245,158,11,0.25)',
                    }}
                  >
                    {isProcess ? (
                      live ? (
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
                      <span className="text-[12.5px] font-medium text-[#f5f5f5]">{entry.step_name}</span>
                      {live && (
                        <span className="text-[9px] font-mono uppercase tracking-wider text-[#93c5fd] bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.3)] px-1.5 py-0.5 rounded">
                          Live
                        </span>
                      )}
                      {!isProcess && entry.qc_result && (
                        <span
                          className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{
                            color: entry.qc_result.passed ? '#86efac' : '#ef4444',
                            background: entry.qc_result.passed
                              ? 'rgba(134,239,172,0.12)'
                              : 'rgba(239,68,68,0.12)',
                            border: entry.qc_result.passed
                              ? '1px solid rgba(134,239,172,0.25)'
                              : '1px solid rgba(239,68,68,0.25)',
                          }}
                        >
                          {entry.qc_result.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[#888888]">{entry.operator_name}</span>
                      <span className="text-[#3a3a3a]">·</span>
                      <span className="text-[11px] font-mono text-[#5a5a5a]">
                        {formatTimestamp(entry.started_at)}
                      </span>
                      {entry.duration_minutes !== null && (
                        <>
                          <span className="text-[#3a3a3a]">·</span>
                          <span className="text-[11px] font-mono text-[#5a5a5a]">
                            {entry.duration_minutes}m
                          </span>
                        </>
                      )}
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
                      {entry.params.length > 0 ? (
                        <table className="w-full">
                          <tbody className="divide-y divide-[#141414]">
                            {entry.params.map((p, idx) => (
                              <tr key={`${entry.id}-${idx}`}>
                                <td className="px-3 py-1.5 text-[11px] text-[#5a5a5a] font-mono w-1/2">
                                  {p.key}
                                </td>
                                <td className="px-3 py-1.5 text-[11px] text-[#f5f5f5] font-mono">
                                  {p.value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="px-3 py-2 text-[11px] text-[#5a5a5a]">No parameters</div>
                      )}
                      {!isProcess && entry.qc_result?.notes && (
                        <div className="border-t border-[#141414] px-3 py-2 bg-[#161616]">
                          <div className="text-[10px] text-[#888888] mb-1">Notes:</div>
                          <div className="text-[11px] text-[#f5f5f5]">{entry.qc_result.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DataState>
    </div>
  );
}
