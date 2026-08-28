'use client';
import { useState, Fragment } from 'react';
import { Shell } from '@/components/shell';
import { IconPlus, IconChevronDown, IconChevronRight } from '@/components/icons';

const RECIPES = [
  { id: 'RCP-001', name: 'Standard Cathode Coat v3', process: 'Coating', version: '3.2', createdBy: 'K. Chen', updatedAt: '2026-04-28', active: true,
    params: [{ k: 'Web speed', v: '8.5 m/min' }, { k: 'Gap (front)', v: '180 µm' }, { k: 'TC-1 target', v: '82°C' }, { k: 'TC-2 target', v: '90°C' }] },
  { id: 'RCP-002', name: 'Anode Mixing Standard', process: 'Mixing', version: '2.0', createdBy: 'L. Tan', updatedAt: '2026-04-20', active: true,
    params: [{ k: 'Mixing speed', v: '2500 rpm' }, { k: 'Duration', v: '45 min' }, { k: 'Temperature', v: '25°C' }] },
  { id: 'RCP-003', name: 'High-Density Coat v1', process: 'Coating', version: '1.0', createdBy: 'K. Chen', updatedAt: '2026-04-15', active: false,
    params: [{ k: 'Web speed', v: '6.0 m/min' }, { k: 'Gap (front)', v: '210 µm' }] },
  { id: 'RCP-004', name: 'Calendaring Standard', process: 'Calendaring', version: '1.5', createdBy: 'R. Mehta', updatedAt: '2026-04-10', active: true,
    params: [{ k: 'Roll pressure', v: '12.0 MPa' }, { k: 'Roll temp', v: '85°C' }, { k: 'Speed', v: '15 m/min' }] },
];

export default function RecipesPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [actives, setActives] = useState<Record<string, boolean>>(
    Object.fromEntries(RECIPES.map(r => [r.id, r.active]))
  );

  function toggle(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <Shell title="Recipes" subtitle="/ Process parameters"
      headerActions={
        <button className="h-9 px-3 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors">
          <IconPlus size={14} /> New Recipe
        </button>
      }
    >
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">
        <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['', 'Recipe', 'Process', 'Version', 'Created by', 'Last updated', 'Active'].map(h => (
                  <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {RECIPES.map(r => {
                const isOpen = expanded.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-[#141414] transition-colors cursor-pointer" onClick={() => toggle(r.id)}>
                      <td className="px-4 py-3 w-8">
                        {isOpen ? <IconChevronDown size={14} className="text-[#5a5a5a]" /> : <IconChevronRight size={14} className="text-[#5a5a5a]" />}
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-[12.5px] font-medium text-[#f5f5f5]">{r.name}</div>
                        <div className="text-[10.5px] font-mono text-[#5a5a5a]">{r.id}</div>
                      </td>
                      <td className="px-5 py-3 text-[12px] text-[#888888]">{r.process}</td>
                      <td className="px-5 py-3 font-mono text-[12px] text-[#888888]">v{r.version}</td>
                      <td className="px-5 py-3 text-[12px] text-[#888888]">{r.createdBy}</td>
                      <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{r.updatedAt}</td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setActives(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                          className={'relative inline-flex h-5 w-9 rounded-full transition-colors ' + (actives[r.id] ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]')}
                        >
                          <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ' + (actives[r.id] ? 'translate-x-4' : 'translate-x-0.5')} />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={r.id + '-params'} className="bg-[#0d0d0d]">
                        <td colSpan={7} className="px-10 py-4">
                          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-2">Parameters</div>
                          <div className="grid grid-cols-4 gap-2">
                            {r.params.map(p => (
                              <div key={p.k} className="rounded-lg border border-[#1e1e1e] bg-[#111] px-3 py-2">
                                <div className="text-[10px] font-mono text-[#5a5a5a]">{p.k}</div>
                                <div className="text-[13px] font-mono text-[#f5f5f5] mt-1">{p.v}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="pt-2 pb-1 text-[11px] font-mono text-[#5a5a5a]">FLINT TRACEABILITY v2 · BUILD 2026.04.30</footer>
      </main>
    </Shell>
  );
}
