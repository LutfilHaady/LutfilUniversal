'use client'

import { useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/status-badge'
import { BatchStatus, type SubBatch } from '@/lib/types'

const TAB_MAP: Array<{ label: string; value: BatchStatus | 'All' }> = [
  { label: 'All',         value: 'All' },
  { label: 'In Progress', value: 'InProgress' },
  { label: 'On Hold',     value: 'OnHold' },
  { label: 'Quarantine',  value: 'Quarantine' },
  { label: 'Released',    value: 'Released' },
  { label: 'Scrapped',    value: 'Scrapped' },
]

interface SubBatchTableProps {
  subBatches: SubBatch[]
}

export function SubBatchTable({ subBatches }: SubBatchTableProps) {
  const [activeTab, setActiveTab] = useState('All')
  const activeValue = TAB_MAP.find(t => t.label === activeTab)?.value ?? 'All'
  const filtered = activeValue === 'All' ? subBatches : subBatches.filter(sb => sb.status === activeValue)

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Sub-Batch Activity</span>
        <Link href="/batches" className="text-[11.5px] text-[#888888] hover:text-[#f5f5f5] transition-colors">View all →</Link>
      </div>
      <div className="flex items-center gap-1 px-5 py-2 border-b border-[#1e1e1e] overflow-x-auto">
        {TAB_MAP.map(tab => {
          const count = tab.value === 'All' ? null : subBatches.filter(sb => sb.status === tab.value).length
          const isActive = activeTab === tab.label
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={
                'px-3 py-1 rounded-md text-[11.5px] font-medium transition-colors whitespace-nowrap ' +
                (isActive ? 'bg-[#1e1e1e] text-[#f5f5f5] border border-[#363636]' : 'text-[#888888] hover:text-[#f5f5f5]')
              }
            >
              {tab.label}
              {count !== null && <span className="ml-1.5 text-[10px] text-[#5a5a5a]">{count}</span>}
            </button>
          )
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#1e1e1e]">
              {['Sub-Batch ID', 'Material', 'Qty', 'Location', 'Started', 'Status'].map(h => (
                <th key={h} className="px-5 py-2.5 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-[12px] text-[#5a5a5a]">No sub-batches match the current filter.</td></tr>
            ) : (
              filtered.map(sb => (
                <tr key={sb.id} className="hover:bg-[#141414] transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/batches/${encodeURIComponent(sb.parent_batch_id ?? '')}/${encodeURIComponent(sb.id)}`}
                      className="font-mono text-[12px] text-[#93c5fd] hover:text-white transition-colors"
                    >
                      {sb.batch_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[#888888]">{sb.material?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-[12px] text-[#888888] font-mono">
                    {sb.current_quantity != null ? `${sb.current_quantity} ${sb.unit ?? ''}`.trim() : '—'}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[#888888]">{sb.current_location ?? '—'}</td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">
                    {new Date(sb.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={sb.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
