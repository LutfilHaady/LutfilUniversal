'use client';
import { useState } from 'react';
import { Shell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import { IconFilter, IconExternal } from '@/components/icons';

type Tab = 'Batch Summary' | 'QC Analysis' | 'Defect Trends' | 'Compliance';
const TABS: Tab[] = ['Batch Summary', 'QC Analysis', 'Defect Trends', 'Compliance'];

const BATCH_SUMMARY_ROWS = [
  { id: 'MIXC-20260430-A01', category: 'Cathode Electrode', subBatches: 4, avgYield: '95.1%', status: 'InProgress' },
  { id: 'CALN-20260430-A01', category: 'Anode Electrode',   subBatches: 2, avgYield: '96.1%', status: 'InProgress' },
  { id: 'SLIT-20260430-B02', category: 'Separator',         subBatches: 1, avgYield: '—',     status: 'OnHold'    },
  { id: 'MIXC-20260429-A01', category: 'Cathode Electrode', subBatches: 4, avgYield: '93.2%', status: 'Released'  },
  { id: 'CALN-20260429-B01', category: 'Anode Electrode',   subBatches: 2, avgYield: '94.8%', status: 'Released'  },
];

const QC_ROWS = [
  { subbatch: 'MIXC-20260430-A01-03', type: 'Coating QC',       verdict: 'Fail', checkedBy: 'K. Chen', date: '2026-04-30 11:42' },
  { subbatch: 'MIXC-20260430-A01-02', type: 'Coating QC',       verdict: 'Pass', checkedBy: 'L. Tan',  date: '2026-04-30 09:10' },
  { subbatch: 'MIXC-20260430-A01-01', type: 'Mixing QC',        verdict: 'Pass', checkedBy: 'K. Chen', date: '2026-04-30 06:52' },
  { subbatch: 'CALN-20260430-A01-01', type: 'Calendaring QC',   verdict: 'Pass', checkedBy: 'R. Mehta',date: '2026-04-30 08:30' },
];

const DEFECT_ROWS = [
  { defect: 'Dry thickness out of spec', count: 3, affected: 'Coating', severity: 'High' },
  { defect: 'Coating skip',              count: 2, affected: 'Coating', severity: 'Medium' },
  { defect: 'Particle size deviation',   count: 1, affected: 'Mixing',  severity: 'Low' },
];

const SEV_COLOR: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#3b82f6' };

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('Batch Summary');

  return (
    <Shell title="Reports" subtitle="/ Analytics &amp; export">
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">

        {/* Filters + export row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#888888]">
            <IconFilter size={13} /> Date: Apr 29 – Apr 30
          </div>
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#888888]">
            Batch: All batches
          </div>
          <div className="ml-auto flex items-center gap-2">
            {['PDF', 'CSV', 'XLSX'].map(fmt => (
              <button key={fmt} className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#888888] hover:text-[#f5f5f5] inline-flex items-center gap-1.5 transition-colors">
                <IconExternal size={13} /> {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="border-b border-[#2a2a2a] flex gap-0">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={'px-5 py-2.5 text-[13px] font-medium border-b-2 transition-colors ' +
                (tab === t ? 'border-[#22c55e] text-[#f5f5f5]' : 'border-transparent text-[#888888] hover:text-[#f5f5f5]')}>
              {t}
            </button>
          ))}
        </div>

        {/* Batch Summary tab */}
        {tab === 'Batch Summary' && (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['Batch ID', 'Category', 'Sub-batches', 'Avg Yield', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {BATCH_SUMMARY_ROWS.map(r => (
                  <tr key={r.id} className="hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-3 font-mono text-[12px] text-[#f5f5f5]">{r.id}</td>
                    <td className="px-5 py-3 text-[12px] text-[#888888]">{r.category}</td>
                    <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{r.subBatches}</td>
                    <td className="px-5 py-3 text-[12px] font-mono" style={{ color: r.avgYield === '—' ? '#5a5a5a' : '#86efac' }}>{r.avgYield}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* QC Analysis tab */}
        {tab === 'QC Analysis' && (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['Sub-Batch', 'QC Type', 'Verdict', 'Checked by', 'Date'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {QC_ROWS.map(r => (
                  <tr key={r.subbatch + r.type} className="hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-3 font-mono text-[12px] text-[#93c5fd]">{r.subbatch}</td>
                    <td className="px-5 py-3 text-[12px] text-[#888888]">{r.type}</td>
                    <td className="px-5 py-3">
                      <span className="text-[12px] font-semibold" style={{ color: r.verdict === 'Pass' ? '#22c55e' : '#ef4444' }}>{r.verdict}</span>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-[#888888]">{r.checkedBy}</td>
                    <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Defect Trends tab */}
        {tab === 'Defect Trends' && (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['Defect', 'Occurrences', 'Affected Process', 'Severity'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {DEFECT_ROWS.map(r => (
                  <tr key={r.defect} className="hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-3 text-[12px] text-[#f5f5f5]">{r.defect}</td>
                    <td className="px-5 py-3 text-[12px] font-mono text-[#f5f5f5]">{r.count}</td>
                    <td className="px-5 py-3 text-[12px] text-[#888888]">{r.affected}</td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] font-semibold" style={{ color: SEV_COLOR[r.severity] }}>{r.severity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Compliance tab */}
        {tab === 'Compliance' && (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-8 flex flex-col items-center gap-3">
            <div className="text-[#5a5a5a] text-[13px]">Compliance report generation</div>
            <div className="text-[12px] text-[#3a3a3a] font-mono">Connect to Supabase to generate</div>
          </div>
        )}

        <footer className="pt-2 pb-1 text-[11px] font-mono text-[#5a5a5a]">FLINT TRACEABILITY v2 · BUILD 2026.04.30</footer>
      </main>
    </Shell>
  );
}
