'use client';

import { useState, useEffect } from 'react';
import { Shell } from '@/components/shell';
import { IconPlus } from '@/components/icons';
import { MainBatchTable } from '@/components/batches/main-batch-table';
import { CreateBatchModal } from '@/components/batches/create-batch-modal';
import { DataState } from '@/components/data-state';
import type { MainBatch } from '@/lib/types';
import { CATEGORY_TONES } from '@/lib/constants';
import { useBatches } from '@/lib/hooks/useBatches';

// Filter tabs — intentionally overrides lib/data CATEGORIES
// (excludes Cell Assembly, adds Casing per product spec)
const MATERIAL_TABS = [
  'All',
  'Cathode Electrode',
  'Anode Electrode',
  'Electrolyte',
  'Casing',
  'Separator',
] as const;


const BUILD_DATE = (() => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
})();

export default function BatchesPage() {
  const [deepHistory, setDeepHistory]               = useState(false);
  const { batches: fetchedBatches, loading, error } = useBatches(deepHistory);
  const [localBatches, setLocalBatches]             = useState<MainBatch[]>([]);
  const [modalOpen, setModalOpen]                   = useState(false);
  const [activeCategory, setActiveCategory]         = useState<string>('All');
  const [toast, setToast]                           = useState<string | null>(null);
  const [footerTime, setFooterTime] = useState<string>('--:--');

  // Merge: locally created batches appear immediately without re-fetch
  const batches = [
    ...localBatches,
    ...fetchedBatches.filter((fb) => !localBatches.find((lb) => lb.id === fb.id)),
  ];

  // Derive KPI values from current batch state
  const totalActive = batches.length;
  const inProgress  = batches.flatMap((b) => b.sub_batches).filter((s) => s.status === 'InProgress').length;
  const onHold      = batches.flatMap((b) => b.sub_batches).filter((s) => s.status === 'OnHold').length;

  // Footer clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setFooterTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    };
    updateTime();
    const id = setInterval(updateTime, 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  function handleBatchCreated(newBatch: MainBatch) {
    setLocalBatches((prev) => [newBatch, ...prev]);
    setModalOpen(false);
    setToast('Batch registered successfully');
  }

  const filtered =
    activeCategory === 'All'
      ? batches
      : batches.filter((b) => b.material?.name === activeCategory);

  const categoryCounts: Record<string, number> = { All: batches.length };
  for (const cat of MATERIAL_TABS.slice(1)) {
    categoryCounts[cat] = batches.filter((b) => b.material?.name === cat).length;
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
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4 flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Total Active Batches</div>
            <div className="text-[34px] leading-none font-semibold font-mono text-[#f5f5f5]">{totalActive}</div>
            <div className="text-[10.5px] font-mono text-[#5a5a5a]">across {MATERIAL_TABS.length - 1} material types</div>
          </div>
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4 flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Sub-batches In Progress</div>
            <div className="text-[34px] leading-none font-semibold font-mono" style={{ color: '#3b82f6' }}>{inProgress}</div>
            <div className="text-[10.5px] font-mono text-[#5a5a5a]">active runs across all lines</div>
          </div>
          <div className={
            'rounded-xl border bg-[#111111] px-5 py-4 flex flex-col gap-2 ' +
            (onHold > 0 ? 'border-[rgba(245,158,11,0.4)]' : 'border-[#2a2a2a]')
          }>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Sub-batches On Hold</div>
            <div
              className="text-[34px] leading-none font-semibold font-mono"
              style={{ color: onHold > 0 ? '#f59e0b' : '#f5f5f5' }}
            >
              {onHold}
            </div>
            <div className="text-[10.5px] font-mono text-[#5a5a5a]">
              {onHold > 0 ? 'require attention' : 'no holds active'}
            </div>
          </div>
        </div>

        {/* History depth toggle */}
        <div className="flex items-center justify-between px-5 py-3 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f]">
          <div className="flex flex-col gap-1">
            <div className="text-[12px] font-medium text-[#f5f5f5]">Batch History</div>
            <div className="text-[10.5px] text-[#888888]">
              {deepHistory ? 'Showing last 30 days' : 'Showing last 7 days'}
            </div>
          </div>
          <button
            onClick={() => setDeepHistory(!deepHistory)}
            className={
              'px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ' +
              (deepHistory
                ? 'bg-[#22c55e] text-black hover:bg-emerald-500'
                : 'bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-[#f5f5f5]')
            }
          >
            {deepHistory ? 'Show all batches' : 'Show all batches'}
          </button>
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center gap-0 border-b border-[#2a2a2a]">
          {MATERIAL_TABS.map((cat) => {
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
                {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />}
                {cat}
                <span className="text-[10.5px] font-mono text-[#5a5a5a] ml-0.5">
                  {categoryCounts[cat] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <DataState loading={loading} error={error} empty={!loading && !error && batches.length === 0} emptyMessage="No batches found">
          <MainBatchTable initialExpanded={[]} batches={filtered} />
        </DataState>
      </main>

      {/* Footer bar */}
      <div className="shrink-0 px-6 py-2.5 border-t border-[#1a1a1a] bg-[#0a0a0a] flex items-center justify-between">
        <span className="text-[10.5px] font-mono text-[#5a5a5a]">
          FLINT TRACEABILITY v2 · BUILD {BUILD_DATE}
        </span>
        <span className="text-[10.5px] font-mono text-[#5a5a5a]">
          SHIFT: DAY · {footerTime} SGT · ALL SYSTEMS NOMINAL
        </span>
      </div>

      {/* Panel */}
      {modalOpen && (
        <CreateBatchModal
          onClose={() => setModalOpen(false)}
          onCreated={handleBatchCreated}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 pl-1 pr-4 py-3 rounded-lg border border-[#2a2a2a] bg-[#111111] shadow-2xl">
          <div className="w-1 self-stretch rounded-full bg-[#22c55e]" />
          <span className="text-[13px] text-[#f5f5f5]">{toast}</span>
        </div>
      )}
    </Shell>
  );
}
