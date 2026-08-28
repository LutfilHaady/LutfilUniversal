'use client';

import { useState } from 'react';
import { Shell } from '@/components/shell';
import { useAuth } from '@/lib/auth-context';
import { StatusBadge } from '@/components/status-badge';
import { IconSearch, IconAlert, IconChevronRight, IconShield, IconRefresh } from '@/components/icons';
import GenealogyImpactMap from '@/components/recall/GenealogyImpactMap';
import type { GenealogyResponse, GenealogyNode, GenealogyEdge, NodeKind, RiskLevel } from '@/components/recall/GenealogyImpactMap/types';
import supabase from '@/lib/supabase';

type InvestigationState = 'idle' | 'searching' | 'results';

interface GenealogyRpcRow {
  id: string;
  batch_number: string;
  parent_batch_id: string | null;
  material_id: string;
  status: string;
  current_quantity: number;
  unit: string;
  depth: number;
  direction: string;
}

interface AffectedItem {
  id: string;
  type: string;
  status: string;
  risk: 'high' | 'medium' | 'low';
  reason: string;
}

const RISK_STYLES = {
  high:   { color: '#fca5a5', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'High' },
  medium: { color: '#fcd34d', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  label: 'Medium' },
  low:    { color: '#86efac', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   label: 'Low' },
};

function toRisk(status: string, depth: number): 'high' | 'medium' | 'low' {
  if (depth === 0) return 'high';
  if (['OnHold', 'Quarantine', 'Scrapped'].includes(status)) return 'high';
  if (status === 'InProgress') return 'medium';
  return 'low';
}

function toKind(row: GenealogyRpcRow): NodeKind {
  if (row.depth === 0) return 'focus';
  if (row.depth === -1) return 'parent_batch';
  if (row.depth < -1) return 'input_material';
  return 'descendant_batch';
}

function mapRpcToGenealogy(
  rows: GenealogyRpcRow[],
  materialMap: Record<string, string>,
): GenealogyResponse {
  const uuidSet = new Set(rows.map(r => r.id));

  const toNode = (row: GenealogyRpcRow): GenealogyNode => ({
    id:            row.batch_number,
    uuid:          row.id,
    kind:          toKind(row),
    material_name: materialMap[row.material_id] ?? row.batch_number,
    status:        row.status,
    risk:          toRisk(row.status, row.depth) as RiskLevel,
    reason:
      row.depth === 0 ? 'Batch under investigation' :
      row.depth < 0  ? 'Ancestor in trace path' :
                       'Descendant in trace path',
    tier: row.depth,
  });

  const selfRow      = rows.find(r => r.depth === 0)!;
  const ancestorRows = rows.filter(r => r.depth < 0).sort((a, b) => a.depth - b.depth);
  const descendantRows = rows.filter(r => r.depth > 0).sort((a, b) => a.depth - b.depth);

  const edges: GenealogyEdge[] = rows
    .filter(r => r.parent_batch_id !== null && uuidSet.has(r.parent_batch_id))
    .map(r => ({
      from_uuid:   r.parent_batch_id!,
      to_uuid:     r.id,
      highlighted: Math.abs(r.depth) <= 1,
    }));

  return {
    focus:       toNode(selfRow),
    ancestors:   ancestorRows.map(toNode),
    descendants: descendantRows.map(toNode),
    edges,
  };
}

function mapRpcToAffected(rows: GenealogyRpcRow[]): AffectedItem[] {
  return rows
    .map(r => ({
      id:     r.batch_number,
      type:   r.parent_batch_id ? 'Sub-Batch' : 'Batch',
      status: r.status,
      risk:   toRisk(r.status, r.depth),
      reason:
        r.depth === 0 ? 'Batch under investigation' :
        r.depth < 0  ? 'Ancestor in trace path' :
                       'Descendant in trace path',
    }))
    .sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return order[a.risk] - order[b.risk];
    });
}

export default function RecallPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<InvestigationState>('idle');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [genealogyData, setGenealogyData] = useState<GenealogyResponse | null>(null);
  const [affectedItems, setAffectedItems] = useState<AffectedItem[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  if (user && user.role === 'Operator') {
    return (
      <Shell title="Recall & Traceability">
        <main className="flex-1 min-h-0 px-6 py-5 flex items-center justify-center">
          <div className="text-[13px] text-[#5a5a5a]">
            Access restricted — Engineer or Admin only.
          </div>
        </main>
      </Shell>
    );
  }

  async function runInvestigation(batchNumber: string) {
    if (!batchNumber.trim()) return;
    setState('searching');
    setFetchError(null);
    setGenealogyData(null);
    setAffectedItems([]);

    try {
      // 1. Resolve batch_number → UUID
      const { data: batchRow, error: batchErr } = await supabase
        .from('batches')
        .select('id')
        .eq('batch_number', batchNumber.trim())
        .single();

      if (batchErr || !batchRow) {
        setFetchError(`Batch "${batchNumber.trim()}" was not found in the database.`);
        setState('results');
        return;
      }

      // 2. Run genealogy RPC
      const { data: rpcRows, error: rpcErr } = await supabase
        .rpc('trace_batch_genealogy', { p_batch_id: batchRow.id });

      if (rpcErr || !rpcRows) {
        setFetchError(rpcErr?.message ?? 'Failed to run genealogy trace.');
        setState('results');
        return;
      }

      // 3. Fetch material names for all material_ids in the result
      const materialIds = [...new Set((rpcRows as GenealogyRpcRow[]).map(r => r.material_id).filter(Boolean))];
      const { data: materials } = await supabase
        .from('materials')
        .select('id, name')
        .in('id', materialIds);
      const materialMap: Record<string, string> = Object.fromEntries(
        (materials ?? []).map((m: { id: string; name: string }) => [m.id, m.name]),
      );

      // 4. Map to component data structures
      const typedRows = rpcRows as GenealogyRpcRow[];
      setGenealogyData(mapRpcToGenealogy(typedRows, materialMap));
      setAffectedItems(mapRpcToAffected(typedRows));
      setState('results');
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Unexpected error — check console');
      setState('results');
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    runInvestigation(query);
  }

  function reset() {
    setQuery('');
    setState('idle');
    setSelectedItem(null);
    setGenealogyData(null);
    setAffectedItems([]);
    setFetchError(null);
  }

  const highRiskCount    = affectedItems.filter(a => a.risk === 'high').length;
  const batchCount       = affectedItems.filter(a => a.type === 'Batch').length;

  return (
    <Shell
      title="Recall & Traceability"
      headerActions={
        state !== 'idle' && (
          <button
            onClick={reset}
            className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12.5px] text-[#888888] hover:text-[#f5f5f5] inline-flex items-center gap-1.5 transition-colors"
          >
            <IconRefresh size={13} /> New Investigation
          </button>
        )
      }
    >
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">

        {/* Search */}
        <form onSubmit={handleSearch}>
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <IconShield size={16} className="text-[#fca5a5]" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#f5f5f5]">Traceability Investigation</div>
                <div className="text-[12px] text-[#888888] mt-0.5">
                  Enter a batch ID or sub-batch ID to trace all related records.
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a5a]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. MTC1-20260521-A20"
                  className="w-full h-10 pl-9 pr-4 rounded-lg border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#4a4a4a] outline-none focus:border-[#ef4444] transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!query.trim() || state === 'searching'}
                className="h-10 px-5 rounded-lg font-semibold text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.35)' }}
              >
                Investigate
              </button>
            </div>
          </div>
        </form>

        {/* Searching state */}
        {state === 'searching' && (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-8 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#ef4444] border-t-transparent animate-spin" />
            <div className="text-[13px] text-[#888888]">Tracing all related records…</div>
          </div>
        )}

        {/* Results */}
        {state === 'results' && (
          <>
            {/* Error state */}
            {fetchError && (
              <div className="px-4 py-3 rounded-xl border border-[rgba(239,68,68,.3)] bg-[rgba(239,68,68,.08)] text-[12.5px] text-[#fca5a5] font-mono">
                {fetchError}
              </div>
            )}

            {!fetchError && (
              <>
                {/* Impact summary */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Affected Records', value: affectedItems.length.toString(), color: '#ef4444' },
                    { label: 'High Risk',         value: highRiskCount.toString(),         color: '#ef4444' },
                    { label: 'Batches Impacted',  value: batchCount.toString(),            color: '#f59e0b' },
                  ].map((k) => (
                    <div key={k.label} className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4">
                      <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">{k.label}</div>
                      <div className="text-[26px] font-semibold mt-2 leading-none" style={{ color: k.color }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Alert */}
                <div
                  className="flex items-start gap-3 px-5 py-4 rounded-xl border"
                  style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.25)' }}
                >
                  <IconAlert size={15} className="text-[#ef4444] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[13px] font-semibold text-[#fca5a5]">Investigation: {query}</div>
                    <div className="text-[12px] text-[#888888] mt-1">
                      {affectedItems.length} record{affectedItems.length !== 1 ? 's' : ''} identified.
                      {highRiskCount > 0 && ' High-risk items require immediate review.'}
                    </div>
                  </div>
                </div>

                {/* Affected records table */}
                {affectedItems.length > 0 && (
                  <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
                      <span className="text-[13px] font-semibold text-[#f5f5f5]">Affected Records</span>
                      <span className="text-[11px] font-mono text-[#5a5a5a]">Sorted by risk level</span>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1e1e1e]">
                          {['Record ID', 'Type', 'Status', 'Risk Level', 'Reason', ''].map((h) => (
                            <th key={h} className="px-5 py-2.5 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] text-left whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a1a1a]">
                        {affectedItems.map((item) => {
                          const risk = RISK_STYLES[item.risk];
                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-[#141414] transition-colors cursor-pointer"
                              onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
                            >
                              <td className="px-5 py-3 font-mono text-[12px] text-[#93c5fd]">{item.id}</td>
                              <td className="px-5 py-3 text-[12px] text-[#888888]">{item.type}</td>
                              <td className="px-5 py-3">
                                <StatusBadge status={item.status} />
                              </td>
                              <td className="px-5 py-3">
                                <span
                                  className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-medium border"
                                  style={{ background: risk.bg, color: risk.color, borderColor: risk.border }}
                                >
                                  {risk.label}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-[12px] text-[#888888]">{item.reason}</td>
                              <td className="px-5 py-3 text-right">
                                <IconChevronRight size={13} className="text-[#5a5a5a] ml-auto" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Genealogy Impact Map */}
                {genealogyData && (
                  <GenealogyImpactMap
                    investigationId={query}
                    data={genealogyData}
                    onTraceNewInvestigation={(newId) => {
                      setQuery(newId);
                      runInvestigation(newId);
                    }}
                  />
                )}

                {/* Action panel */}
                <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-5">
                  <div className="text-[13px] font-semibold text-[#f5f5f5] mb-3">Recommended Actions</div>
                  <div className="flex flex-col gap-2">
                    {[
                      'Place high-risk sub-batches on Hold',
                      'Notify QC team for re-inspection',
                      'Generate recall report for regulatory file',
                    ].map((label) => (
                      <div
                        key={label}
                        className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1e1e1e] bg-[#0e0e0e]"
                      >
                        <span className="text-[12.5px] text-[#888888]">{label}</span>
                        <button
                          onClick={() => showToast('This action will be enabled once the backend is connected.')}
                          className="text-[11.5px] font-medium text-[#93c5fd] hover:text-white transition-colors"
                        >
                          Execute →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Empty state */}
        {state === 'idle' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <IconShield size={22} className="text-[#ef4444]/50" />
            </div>
            <div className="text-[13px] text-[#5a5a5a] text-center max-w-xs">
              Enter any batch ID or sub-batch ID to start a traceability investigation.
            </div>
          </div>
        )}

        <footer className="pt-2 pb-1 flex items-center justify-between text-[11px] font-mono text-[#5a5a5a]">
          <span>FLINT TRACEABILITY v2 · BUILD 2026.04.30</span>
          <span>SHIFT DAY · ALL SYSTEMS NOMINAL</span>
        </footer>

        {toast && (
          <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[12.5px] text-[#f5f5f5] shadow-lg">
            {toast}
          </div>
        )}
      </main>
    </Shell>
  );
}
