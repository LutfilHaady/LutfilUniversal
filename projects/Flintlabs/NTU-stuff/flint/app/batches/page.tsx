'use client';

import { useState } from 'react';
import { Shell } from '@/components/shell';
import { IconPlus } from '@/components/icons';
import { MainBatchTable } from '@/components/batches/main-batch-table';
import { CreateBatchModal } from '@/components/batches/create-batch-modal';
import { MAIN_BATCHES, CATEGORIES, CATEGORY_TONES } from '@/lib/data';

// Derive KPI values from data
const totalActive = MAIN_BATCHES.length;
const inProgress  = MAIN_BATCHES.flatMap(b => b.subBatches).filter(s => s.status === 'InProgress').length;
const onHold      = MAIN_BATCHES.flatMap(b => b.subBatches).filter(s => s.status === 'OnHold').length;

// Category filter options
const CATEGORY_TABS = ['All', ...CATEGORIES] as const;

export default function BatchesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filtered = activeCategory === 'All'
    ? MAIN_BATCHES
    : MAIN_BATCHES.filter(b => b.category === activeCategory);

  const categoryCounts: Record<string, number> = { All: MAIN_BATCHES.length };
  for (const cat of CATEGORIES) {
    categoryCounts[cat] = MAIN_BATCHES.filter(b => b.category === cat).length;
  }

  return (
    <Shell
      title="Batches"
      headerActions={
        <button
          onClick={() => setModalOpen(true)}
          className="h-9 px-3 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <IconPlus size={14} /> New Batch
        </button>
      }
    >
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* Total Active Batches */}
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Total Active Batches</div>
            </div>
            <div className="text-[34px] leading-none font-semibold font-mono num-tnum text-[#f5f5f5]">{totalActive}</div>
            <div className="text-[10.5px] font-mono text-[#5a5a5a]">across {CATEGORIES.length} material types</div>
          </div>

          {/* Sub-batches In Progress */}
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Sub-batches In Progress</div>
            </div>
            <div className="text-[34px] leading-none font-semibold font-mono num-tnum" style={{ color: '#3b82f6' }}>{inProgress}</div>
            <div className="text-[10.5px] font-mono text-[#5a5a5a]">active runs across all lines</div>
          </div>

          {/* Sub-batches On Hold */}
          <div className={
            'rounded-xl border bg-[#111111] px-5 py-4 flex flex-col gap-2 ' +
            (onHold > 0 ? 'border-[rgba(245,158,11,0.4)]' : 'border-[#2a2a2a]')
          }>
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Sub-batches On Hold</div>
            </div>
            <div className="text-[34px] leading-none font-semibold font-mono num-tnum" style={{ color: onHold > 0 ? '#f59e0b' : '#f5f5f5' }}>{onHold}</div>
            <div className="text-[10.5px] font-mono text-[#5a5a5a]">{onHold > 0 ? 'require attention' : 'no holds active'}</div>
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center gap-0 border-b border-[#2a2a2a]">
          {CATEGORY_TABS.map(cat => {
            const isActive = activeCategory === cat;
            const dot = cat !== 'All' ? CATEGORY_TONES[cat] : null;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={
                  'flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ' +
                  (isActive
                    ? 'border-[#22c55e] text-[#f5f5f5]'
                    : 'border-transparent text-[#888888] hover:text-[#f5f5f5]')
                }
              >
                {dot && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
                )}
                {cat}
                <span className="text-[10.5px] font-mono text-[#5a5a5a] ml-0.5">
                  {categoryCounts[cat] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <MainBatchTable initialExpanded={['MIXC-20260430-A01']} batches={filtered} />
      </main>

      {modalOpen && <CreateBatchModal onClose={() => setModalOpen(false)} />}
    </Shell>
  );
}
