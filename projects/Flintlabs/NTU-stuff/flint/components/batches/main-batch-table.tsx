'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { SummaryRow } from '@/components/batches/summary-row';
import { MAIN_BATCHES, CATEGORY_TONES } from '@/lib/data';
import { IconChevronDown, IconChevronRight } from '@/components/icons';

interface MainBatchTableProps {
  initialExpanded?: string[];
  batches?: typeof MAIN_BATCHES;
}

export function MainBatchTable({ initialExpanded = [], batches = MAIN_BATCHES }: MainBatchTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(initialExpanded));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[#2a2a2a]">
            {['Batch ID', 'Category', 'Total Qty', 'Remaining', 'Supplier', 'Received', 'Sub-Batches', ''].map((h) => (
              <th
                key={h}
                className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1a1a1a]">
          {batches.map((batch) => {
            const isOpen = expanded.has(batch.id);
            const accentColor = CATEGORY_TONES[batch.category] ?? '#888888';

            return (
              <Fragment key={batch.id}>
                {/* Main batch row */}
                <tr
                  className="hover:bg-[#141414] transition-colors cursor-pointer"
                  onClick={() => toggle(batch.id)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button className="text-[#5a5a5a] hover:text-[#f5f5f5] transition-colors">
                        {isOpen
                          ? <IconChevronDown size={14} />
                          : <IconChevronRight size={14} />}
                      </button>
                      <Link
                        href={`/batches/${encodeURIComponent(batch.id)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[12px] text-[#f5f5f5] hover:text-[#93c5fd] transition-colors"
                      >
                        {batch.id}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: accentColor }}
                      />
                      <span className="text-[12px] text-[#888888]">{batch.category}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{batch.qty}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-[#888888]">{batch.remaining}</span>
                      <div className="w-16 h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${batch.remainingPct}%`, background: accentColor }}
                        />
                      </div>
                      <span className="text-[10.5px] font-mono text-[#5a5a5a]">{batch.remainingPct}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[#888888]">{batch.supplier}</td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{batch.received}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-mono text-[#888888]">{batch.subBatches.length}</span>
                      <div className="flex gap-0.5">
                        {batch.subBatches.map((sb) => (
                          <span
                            key={sb.id}
                            className="w-2 h-2 rounded-full"
                            style={{
                              background:
                                sb.status === 'Released'   ? '#22c55e'
                                : sb.status === 'InProgress' ? '#3b82f6'
                                : sb.status === 'OnHold'     ? '#f59e0b'
                                : sb.status === 'Quarantine' ? '#a855f7'
                                : '#ef4444',
                            }}
                            title={`${sb.id}: ${sb.status}`}
                          />
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/batches/${encodeURIComponent(batch.id)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#5a5a5a] hover:text-[#888888] transition-colors inline-flex items-center"
                    >
                      <IconChevronRight size={16} />
                    </Link>
                  </td>
                </tr>

                {/* Expanded sub-batch rows */}
                {isOpen && (
                  <>
                    <tr className="bg-[#0d0d0d]">
                      <td colSpan={8} className="px-0 py-0">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#1a1a1a]">
                              {['Sub-Batch ID', 'Qty', 'Machine', 'Operator', 'Started', 'Yield', 'Status'].map((h) => (
                                <th
                                  key={h}
                                  className={`${h === 'Sub-Batch ID' ? 'pl-10 pr-4' : 'px-4'} py-2 text-[10px] font-mono uppercase tracking-[0.1em] text-[#3a3a3a] whitespace-nowrap`}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#141414]">
                            {batch.subBatches.map((sb) => (
                              <SummaryRow key={sb.id} subBatch={sb} />
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
