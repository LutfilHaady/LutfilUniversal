'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { useAuth } from '@/lib/auth-context';
import { StatusBadge } from '@/components/status-badge';
import { IconPlus, IconBatches, IconCheck, IconBox } from '@/components/icons';
import { GenerateLotPanel } from '@/components/lots/generate-lot-panel';
import { DataState } from '@/components/data-state';
import { useLots } from '@/lib/hooks/useLots';
import supabase from '@/lib/supabase';
import type { Lot, SubBatch } from '@/lib/types';

export default function LotsPage() {
  const { user } = useAuth();
  const role = user?.role ?? 'Operator';
  const { lots: fetchedLots, loading, error } = useLots();
  const [localLots, setLocalLots]               = useState<Lot[]>([]);
  const [panelOpen, setPanelOpen]               = useState(false);
  const [toast, setToast]                       = useState<string | null>(null);
  const [availableSubBatches, setAvailableSubBatches] = useState<SubBatch[]>([]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    async function fetchAvailableSubBatches() {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_number, material_id, current_quantity, unit, materials(name)')
        .eq('status', 'Released')
        .not('parent_batch_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[LotsPage] Failed to fetch available sub-batches:', error.message);
        return;
      }

      const mapped = (data ?? []).map((b: any) => ({
        ...b,
        category: Array.isArray(b.materials) ? b.materials[0]?.name : b.materials?.name ?? 'Uncategorized',
        qty: `${b.current_quantity ?? '—'} ${b.unit ?? ''}`.trim(),
        machine: null,
      })) as SubBatch[];

      setAvailableSubBatches(mapped);
    }

    fetchAvailableSubBatches();
  }, []);

  const lots = [...localLots, ...fetchedLots.filter(fl => !localLots.find(ll => ll.id === fl.id))];

  const totalLots       = lots.length;
  const totalUnits      = lots.reduce((s, l) => s + l.unit_count, 0);
  const totalSourceSubs = new Set(lots.flatMap(l => l.lot_sub_batches.map(x => x.sub_batch_id))).size;

  function handleLotGenerated(lot: Lot) {
    setLocalLots(prev => [lot, ...prev]);
    setPanelOpen(false);
    setToast(`Lot ${lot.lot_number} generated — ${lot.unit_count} units serialized`);
  }

  return (
    <Shell
      title="Lots"
      headerActions={
        role !== 'Operator' ? (
          <button
            onClick={() => setPanelOpen(true)}
            className="h-9 px-3 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={14} /> Generate Lot
          </button>
        ) : undefined
      }
    >
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">
        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4">
          {([
            { label: 'Total Lots',          value: String(totalLots),       sub: 'across all categories', Icon: IconBox,     accent: '#22c55e' },
            { label: 'Units Serialized',    value: String(totalUnits),      sub: 'across all open lots',  Icon: IconCheck,   accent: '#3b82f6' },
            { label: 'Source Sub-batches',  value: String(totalSourceSubs), sub: 'contributing to lots',  Icon: IconBatches, accent: '#a855f7' },
          ] as const).map(k => (
            <div key={k.label} className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#888888]">{k.label}</span>
                <div className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: `${k.accent}18`, border: `1px solid ${k.accent}33` }}>
                  <k.Icon size={14} style={{ color: k.accent }} />
                </div>
              </div>
              <div className="text-[34px] leading-none font-semibold font-mono num-tnum text-[#f5f5f5]">{k.value}</div>
              <div className="text-[11px] text-[#888888]">{k.sub}</div>
            </div>
          ))}
        </div>

        <DataState loading={loading} error={error} empty={lots.length === 0} emptyMessage="No lots found">
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
              <span className="text-[13px] font-semibold text-[#f5f5f5]">All Lots</span>
              <span className="text-[11px] font-mono text-[#5a5a5a]">{lots.length} lots</span>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['Lot ID', 'Category', 'Units', 'Source Sub-batches', 'Created', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {lots.map(lot => (
                  <tr key={lot.id} className="hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/lots/${encodeURIComponent(lot.id)}`}
                        className="font-mono text-[12px] text-[#93c5fd] hover:text-white transition-colors"
                      >
                        {lot.lot_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-[#888888]">{lot.category}</td>
                    <td className="px-5 py-3 text-[12px] font-mono text-[#f5f5f5] num-tnum">{lot.unit_count}</td>
                    <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{lot.lot_sub_batches.length}</td>
                    <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{lot.created_at}</td>
                    <td className="px-5 py-3"><StatusBadge status={lot.status} /></td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/lots/${encodeURIComponent(lot.id)}`}
                        className="text-[#5a5a5a] hover:text-[#888888] transition-colors inline-flex items-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6"/>
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>

        <footer className="pt-2 pb-1 flex items-center justify-between text-[11px] font-mono text-[#5a5a5a]">
          <span>FLINT TRACEABILITY v2 · BUILD 2026.04.30</span>
          <span>SHIFT DAY · 11:42 SGT</span>
        </footer>
      </main>

      {panelOpen && (
        <GenerateLotPanel
          existingLots={lots}
          availableSubBatches={availableSubBatches}
          onClose={() => setPanelOpen(false)}
          onGenerated={handleLotGenerated}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 pl-1 pr-4 py-3 rounded-lg border border-[#2a2a2a] bg-[#111111] shadow-2xl">
          <div className="w-1 self-stretch rounded-full bg-[#22c55e]" />
          <span className="text-[13px] text-[#f5f5f5]">{toast}</span>
        </div>
      )}
    </Shell>
  );
}
