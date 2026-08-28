'use client';
import { useState, useEffect } from 'react';
import { Shell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import { IconFilter, IconExternal } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type Tab = 'Batch Summary' | 'QC Analysis' | 'Defect Trends' | 'Compliance';
const TABS: Tab[] = ['Batch Summary', 'QC Analysis', 'Defect Trends', 'Compliance'];

export default function ReportsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('Batch Summary');

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [batchSummaryRows, setBatchSummaryRows] = useState<any[]>([]);
  const [qcRows, setQcRows]                     = useState<any[]>([]);
  const [defectRows, setDefectRows]             = useState<{ name: string; count: number }[]>([]);
  const [compliance, setCompliance]             = useState<{
    total: number; passCount: number; failCount: number; overrideCount: number; passRate: number;
  } | null>(null);
  const [toast, setToast]                       = useState<string | null>(null);

  // Gate every fetch on the role check so Operators never issue queries they
  // aren't allowed (the render-time guard below only stops the UI, not the wire).
  const blocked = !user || user.role === 'Operator';

  useEffect(() => {
    if (blocked) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_number, status, current_quantity, unit, created_at, materials(name)')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false });
      if (!error) setBatchSummaryRows(data ?? []);
    };
    fetch();
  }, [dateFrom, dateTo, blocked]);

  useEffect(() => {
    if (blocked) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from('qc_check_results')
        .select('id, passed, created_at, qc_check_definitions(qc_item_name, acceptance_criteria_text), users(full_name)')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false });
      if (!error) setQcRows(data ?? []);
    };
    fetch();
  }, [dateFrom, dateTo, blocked]);

  useEffect(() => {
    if (blocked) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from('qc_check_results')
        .select('qc_check_definition_id, qc_check_definitions(qc_item_name), passed')
        .eq('passed', false)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59');
      if (!error) {
        const grouped = (data ?? []).reduce((acc, row) => {
          const name = (row.qc_check_definitions as any)?.qc_item_name ?? 'Unknown';
          acc[name] = (acc[name] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        setDefectRows(
          Object.entries(grouped)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        );
      }
    };
    fetch();
  }, [dateFrom, dateTo, blocked]);

  // Compliance: QC pass/fail + override counts over the selected range.
  useEffect(() => {
    if (blocked) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from('qc_check_results')
        .select('passed, created_at, qc_overrides(id)')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59');
      if (error) return;
      const rows = data ?? [];
      const total = rows.length;
      const passCount = rows.filter((r: any) => r.passed).length;
      const failCount = total - passCount;
      const overrideCount = rows.filter((r: any) => {
        const o = r.qc_overrides;
        return Array.isArray(o) ? o.length > 0 : !!o;
      }).length;
      const passRate = total ? Math.round((passCount / total) * 1000) / 10 : 0;
      setCompliance({ total, passCount, failCount, overrideCount, passRate });
    };
    fetch();
  }, [dateFrom, dateTo, blocked]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Live rows for the active tab — shared by CSV and XLSX export.
  function activeRows(): object[] {
    const complianceRows = compliance
      ? [{
          pass_rate_pct:  compliance.passRate,
          pass_count:     compliance.passCount,
          fail_count:     compliance.failCount,
          override_count: compliance.overrideCount,
          total_checks:   compliance.total,
          date_from:      dateFrom,
          date_to:        dateTo,
        }]
      : [];
    const dataMap: Record<Tab, object[]> = {
      'Batch Summary': batchSummaryRows,
      'QC Analysis':   qcRows,
      'Defect Trends': defectRows,
      'Compliance':    complianceRows,
    };
    return dataMap[tab];
  }

  function exportFileName(ext: string) {
    return `flint-${tab.toLowerCase().replace(/ /g, '-')}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  function handleCsvExport() {
    const rows = activeRows();
    if (!rows.length) { showToast('No data to export for this tab.'); return; }
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName('csv');
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleXlsxExport() {
    const rows = activeRows();
    if (!rows.length) { showToast('No data to export for this tab.'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab.slice(0, 31));
    XLSX.writeFile(wb, exportFileName('xlsx'));
  }

  if (user && user.role === 'Operator') {
    return (
      <Shell title="Reports" subtitle="/ Analytics &amp; export">
        <main className="flex-1 min-h-0 px-6 py-5 flex items-center justify-center">
          <div className="text-[13px] text-[#5a5a5a]">
            Access restricted — Engineer or Admin only.
          </div>
        </main>
      </Shell>
    );
  }

  return (
    <Shell title="Reports" subtitle="/ Analytics &amp; export">
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">

        {/* Filters + export row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#888888]">
            <IconFilter size={13} className="text-[#22c55e] shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-[#888888] text-[12px] outline-none date-green"
            />
            <span>–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-[#888888] text-[12px] outline-none date-green"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleCsvExport}
              className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#888888] hover:text-[#f5f5f5] inline-flex items-center gap-1.5 transition-colors"
            >
              <IconExternal size={13} /> CSV
            </button>
            <button
              onClick={handleXlsxExport}
              className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#888888] hover:text-[#f5f5f5] inline-flex items-center gap-1.5 transition-colors"
            >
              <IconExternal size={13} /> XLSX
            </button>
            {/* TODO: PDF export not implemented — kept as a toast, not wired. */}
            <button
              onClick={() => showToast('PDF export coming soon.')}
              className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#888888] hover:text-[#f5f5f5] inline-flex items-center gap-1.5 transition-colors"
            >
              <IconExternal size={13} /> PDF
            </button>
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
                  {['Batch ID', 'Material', 'Quantity', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {batchSummaryRows.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-6 text-[12px] text-[#5a5a5a] text-center">No batches in selected date range.</td></tr>
                ) : batchSummaryRows.map(r => (
                  <tr key={r.id} className="hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-3 font-mono text-[12px] text-[#f5f5f5]">{r.batch_number}</td>
                    <td className="px-5 py-3 text-[12px] text-[#888888]">{(r.materials as any)?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">
                      {r.current_quantity != null ? `${r.current_quantity} ${r.unit ?? ''}`.trim() : '—'}
                    </td>
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
                  {['QC Type', 'Verdict', 'Checked by', 'Date'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {qcRows.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-6 text-[12px] text-[#5a5a5a] text-center">No QC results in selected date range.</td></tr>
                ) : qcRows.map(r => {
                  const verdict = r.passed ? 'Pass' : 'Fail';
                  return (
                    <tr key={r.id} className="hover:bg-[#141414] transition-colors">
                      <td className="px-5 py-3 text-[12px] text-[#888888]">{(r.qc_check_definitions as any)?.qc_item_name ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className="text-[12px] font-semibold" style={{ color: verdict === 'Pass' ? '#22c55e' : '#ef4444' }}>{verdict}</span>
                      </td>
                      <td className="px-5 py-3 text-[12px] text-[#888888]">{(r.users as any)?.full_name ?? '—'}</td>
                      <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{r.created_at?.slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                  );
                })}
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
                  {['QC Check', 'Failures'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {defectRows.length === 0 ? (
                  <tr><td colSpan={2} className="px-5 py-6 text-[12px] text-[#5a5a5a] text-center">No failures in selected date range.</td></tr>
                ) : defectRows.map(r => (
                  <tr key={r.name} className="hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-3 text-[12px] text-[#f5f5f5]">{r.name}</td>
                    <td className="px-5 py-3 text-[12px] font-mono text-[#ef4444]">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Compliance tab */}
        {tab === 'Compliance' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'QC Pass Rate', value: compliance ? `${compliance.passRate}%` : '—', sub: compliance ? `${compliance.passCount} / ${compliance.total} checks` : 'No data', color: '#22c55e' },
                { label: 'QC Failures',  value: compliance ? `${compliance.failCount}` : '—', sub: 'failed checks in range', color: '#ef4444' },
                { label: 'QC Overrides', value: compliance ? `${compliance.overrideCount}` : '—', sub: 'engineer overrides in range', color: '#f5f5f5' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-5">
                  <div className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{label}</div>
                  <div className="mt-2 text-[26px] font-semibold leading-none" style={{ color }}>{value}</div>
                  <div className="mt-1.5 text-[11.5px] text-[#888888]">{sub}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-5 flex items-start justify-between gap-6">
              <div>
                <div className="text-[13px] font-semibold text-[#f5f5f5]">Compliance Summary Report</div>
                <div className="mt-1 text-[12px] text-[#888888] max-w-md">
                  QC pass/fail and override counts over the selected date range
                  ({dateFrom} – {dateTo}), exported as CSV for audit records.
                </div>
              </div>
              <button
                onClick={handleCsvExport}
                disabled={!compliance || compliance.total === 0}
                className="shrink-0 h-9 px-4 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#888888] hover:text-[#f5f5f5] enabled:cursor-pointer disabled:text-[#3a3a3a] disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"
              >
                <IconExternal size={13} /> Generate
              </button>
            </div>
            {/* TODO: ISO Trace / GMP Batch Record formal report templates not built —
                Generate exports the raw compliance summary as CSV for now. */}
          </div>
        )}

        <footer className="pt-2 pb-1 text-[11px] font-mono text-[#5a5a5a]">FLINT TRACEABILITY v2 · BUILD 2026.04.30</footer>

        {toast && (
          <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[12.5px] text-[#f5f5f5] shadow-lg">
            {toast}
          </div>
        )}
      </main>
    </Shell>
  );
}
