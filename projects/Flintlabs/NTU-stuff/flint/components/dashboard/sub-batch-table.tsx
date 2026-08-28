'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { SUB_BATCHES, BatchStatus } from '@/lib/data';
import { IconChevronDown } from '@/components/icons';

const TAB_MAP: Array<{ label: string; value: BatchStatus | 'All'; disabled?: boolean }> = [
  { label: 'All',         value: 'All' },
  { label: 'In Progress', value: 'InProgress' },
  { label: 'On Hold',     value: 'OnHold' },
  { label: 'Quarantine',  value: 'Quarantine' },
  { label: 'Released',    value: 'Released' },
  { label: 'Scrapped',    value: 'Scrapped' },
];

const LINES = ['All Lines', 'Coating Line A', 'Coating Line B', 'Calendaring A', 'Calendaring B', 'Slitting Line 1', 'Slitting Line 2'];

export function SubBatchTable() {
  const [activeTab, setActiveTab] = useState('All');
  const [activeLine, setActiveLine] = useState('All Lines');

  const activeValue = TAB_MAP.find(t => t.label === activeTab)?.value ?? 'All';

  const filtered = SUB_BATCHES.filter((sb) => {
    const matchStatus = activeValue === 'All' || sb.status === activeValue;
    const matchLine = activeLine === 'All Lines' || sb.machine === activeLine;
    return matchStatus && matchLine;
  });

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Sub-Batch Activity</span>
        <div className="flex items-center gap-2">
          {/* Line filter */}
          <div className="relative">
            <select
              value={activeLine}
              onChange={(e) => setActiveLine(e.target.value)}
              className="appearance-none h-7 pl-3 pr-7 rounded-md border border-[#2a2a2a] bg-[#161616] text-[11.5px] text-[#888888] outline-none cursor-pointer hover:text-[#f5f5f5] transition-colors"
            >
              {LINES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <IconChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5a5a5a] pointer-events-none" />
          </div>
          <Link
            href="/batches"
            className="text-[11.5px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
          >
            View all →
          </Link>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-[#1e1e1e] overflow-x-auto">
        {TAB_MAP.map((tab) => {
          const count = tab.value === 'All' ? null : SUB_BATCHES.filter(sb => sb.status === tab.value).length;
          const isActive = activeTab === tab.label;
          return (
            <button
              key={tab.label}
              onClick={() => !tab.disabled && setActiveTab(tab.label)}
              disabled={tab.disabled}
              className={
                'px-3 py-1 rounded-md text-[11.5px] font-medium transition-colors whitespace-nowrap ' +
                (tab.disabled
                  ? 'text-[#3a3a3a] cursor-not-allowed'
                  : isActive
                  ? 'bg-[#1e1e1e] text-[#f5f5f5] border border-[#363636]'
                  : 'text-[#888888] hover:text-[#f5f5f5]')
              }
            >
              {tab.label}
              {count !== null && (
                <span className="ml-1.5 text-[10px] text-[#5a5a5a]">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#1e1e1e]">
              {['Sub-Batch ID', 'Category', 'Qty', 'Machine', 'Operator', 'Started', 'Yield', 'Status'].map((h) => (
                <th key={h} className="px-5 py-2.5 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-[12px] text-[#5a5a5a]">
                  No sub-batches match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((sb) => (
                <tr key={sb.id} className="hover:bg-[#141414] transition-colors group">
                  <td className="px-5 py-3">
                    <Link
                      href={`/batches/${encodeURIComponent(sb.parentId)}/${encodeURIComponent(sb.id)}`}
                      className="font-mono text-[12px] text-[#93c5fd] hover:text-white transition-colors"
                    >
                      {sb.id}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[#888888]">{sb.category}</td>
                  <td className="px-5 py-3 text-[12px] text-[#888888] font-mono">{sb.qty}</td>
                  <td className="px-5 py-3 text-[12px] text-[#888888]">{sb.machine}</td>
                  <td className="px-5 py-3 text-[12px] text-[#888888]">{sb.operator}</td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{sb.started}</td>
                  <td className="px-5 py-3 text-[12px] font-mono">
                    {sb.yield !== null ? (
                      <span className={sb.yield >= 90 ? 'text-[#86efac]' : 'text-[#fca5a5]'}>
                        {sb.yield.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[#5a5a5a]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={sb.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
