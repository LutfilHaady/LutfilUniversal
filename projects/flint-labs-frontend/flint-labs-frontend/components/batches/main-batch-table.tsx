'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { SummaryRow } from '@/components/batches/summary-row';
import type { MainBatch } from '@/lib/types';
import { CATEGORY_TONES } from '@/lib/constants';
import { IconChevronDown, IconChevronRight } from '@/components/icons';

interface MainBatchTableProps {
  initialExpanded?: string[];
  batches?: MainBatch[];
}

function relTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return '—';
  const diffMs = Date.now() - ts;
  const h = diffMs / 36e5;
  if (h < 1) {
    const m = Math.round(diffMs / 6e4);
    return m === 0 ? 'just now' : `${m} min ago`;
  }
  if (h < 24) return `${Math.round(h)} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}

const OUTER_COLS = 9; // 8 data cols + 1 link col

export function MainBatchTable({ initialExpanded = [], batches = [] }: MainBatchTableProps) {
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
            {['Batch ID', 'Material', 'Supplier', 'Total Qty', 'Remaining', 'Sub-Batches', 'Lot Reference', 'Created', ''].map((h) => (
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
            const isOpen = expanded.has(batch.id)
            const materialName = batch.material?.name ?? '—'
            const accentColor = CATEGORY_TONES[materialName] ?? '#888888'
            const totalQty = batch.original_quantity != null
              ? `${batch.original_quantity} ${batch.unit ?? ''}`.trim()
              : '—'
            const remaining = batch.current_quantity != null
              ? `${batch.current_quantity} ${batch.unit ?? ''}`.trim()
              : '—'
            const remainingPct = batch.original_quantity && batch.current_quantity
              ? Math.round((batch.current_quantity / batch.original_quantity) * 100)
              : 0
            const displayDate = batch.intake?.date_received ?? batch.created_at

            return (
              <Fragment key={batch.id}>
                <tr className="hover:bg-[#141414] transition-colors cursor-pointer" onClick={() => toggle(batch.id)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button className="text-[#5a5a5a] hover:text-[#f5f5f5] transition-colors">
                        {isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                      </button>
                      <Link
                        href={`/batches/${encodeURIComponent(batch.id)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[12px] text-[#93c5fd] hover:text-white transition-colors"
                      >
                        {batch.batch_number}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accentColor }} />
                      <span className="text-[12px] text-[#888888]">{materialName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[#888888]">{batch.intake?.supplier_name ?? '—'}</td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{totalQty}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-[#888888]">{remaining}</span>
                      <div className="w-16 h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${remainingPct}%`, background: accentColor }} />
                      </div>
                      <span className="text-[10.5px] font-mono text-[#5a5a5a]">{remainingPct}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-mono text-[#888888]">{batch.sub_batches.length}</span>
                      <div className="flex gap-0.5">
                        {batch.sub_batches.map((sb) => (
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
                            title={`${sb.batch_number}: ${sb.status}`}
                          />
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">
                    <span className="text-[#5a5a5a]">—</span>
                  </td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">
                    {relTime(displayDate)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/batches/${encodeURIComponent(batch.id)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#5a5a5a] hover:text-[#f5f5f5] inline-flex items-center transition-colors"
                      title="Open batch details"
                    >
                      <IconChevronRight size={16} />
                    </Link>
                  </td>
                </tr>

                {isOpen && (
                  <tr className="bg-[#0d0d0d]">
                    <td colSpan={OUTER_COLS} className="px-0 py-0">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#1a1a1a]">
                            {['Sub-Batch ID', 'Quantity', 'Location', 'Status', 'Operator'].map((h) => (
                              <th key={h} className={`${h === 'Sub-Batch ID' ? 'pl-10 pr-4' : 'px-4'} py-2 text-[10px] font-mono uppercase tracking-[0.1em] text-[#3a3a3a] whitespace-nowrap`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#141414]">
                          {batch.sub_batches.map((sb) => (
                            <SummaryRow key={sb.id} subBatch={sb} />
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  );
}
