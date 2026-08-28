'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { IconLink } from '@/components/icons';
import supabase from '@/lib/supabase';

interface GenealogyRow {
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

const STATUS_DOT: Record<string, string> = {
  Released:   '#22c55e',
  InProgress: '#3b82f6',
  OnHold:     '#f59e0b',
  Quarantine: '#a855f7',
  Scrapped:   '#ef4444',
};

function hrefFor(row: GenealogyRow): string {
  return row.parent_batch_id
    ? `/batches/${encodeURIComponent(row.parent_batch_id)}/${encodeURIComponent(row.id)}`
    : `/batches/${encodeURIComponent(row.id)}`;
}

function Node({
  row, materialName, isCurrent,
}: { row: GenealogyRow; materialName: string; isCurrent: boolean }) {
  const dot = STATUS_DOT[row.status] ?? '#5a5a5a';
  return (
    <div className={
      'rounded-lg border px-3 py-2.5 flex items-center justify-between gap-2 ' +
      (isCurrent ? 'border-[#22c55e]/50 bg-[rgba(34,197,94,0.05)]' : 'border-[#1e1e1e] bg-[#0e0e0e]')
    }>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
          {isCurrent ? (
            <span className="font-mono text-[12px] text-[#22c55e] truncate">{row.batch_number}</span>
          ) : (
            <Link href={hrefFor(row)} className="font-mono text-[12px] text-[#93c5fd] hover:text-white transition-colors truncate">
              {row.batch_number}
            </Link>
          )}
          {isCurrent && (
            <span className="text-[9.5px] font-mono text-[#22c55e] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.3)] px-1.5 py-0.5 rounded shrink-0">
              current
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#5a5a5a] mt-0.5 truncate">
          {materialName} · {row.current_quantity} {row.unit}
        </div>
      </div>
      <StatusBadge status={row.status} />
    </div>
  );
}

export function Genealogy({ subBatchId }: { subBatchId: string }) {
  const [rows, setRows] = useState<GenealogyRow[]>([]);
  const [materialMap, setMaterialMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subBatchId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: rpcErr } = await supabase
        .rpc('trace_batch_genealogy', { p_batch_id: subBatchId });
      if (cancelled) return;

      if (rpcErr) {
        setError(rpcErr.message);
        setLoading(false);
        return;
      }

      const result = (data ?? []) as GenealogyRow[];
      setRows(result);

      const materialIds = [...new Set(result.map(r => r.material_id).filter(Boolean))];
      if (materialIds.length > 0) {
        const { data: mats, error: matsErr } = await supabase
          .from('materials').select('id, name').in('id', materialIds);
        if (matsErr) console.warn('[Genealogy] materials fetch failed:', matsErr.message);
        if (!cancelled) {
          setMaterialMap(Object.fromEntries(
            (mats ?? []).map((m: { id: string; name: string }) => [m.id, m.name]),
          ));
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [subBatchId]);

  const ancestors   = rows.filter(r => r.depth < 0).sort((a, b) => a.depth - b.depth);
  const self        = rows.find(r => r.depth === 0) ?? null;
  const descendants = rows.filter(r => r.depth > 0).sort((a, b) => a.depth - b.depth);
  const isEmpty = !loading && !error && self !== null && ancestors.length === 0 && descendants.length === 0;
  const notFound = !loading && !error && self === null;

  const label = (text: string) => (
    <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-2">{text}</div>
  );

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Material Genealogy</span>
        <IconLink size={14} className="text-[#5a5a5a]" />
      </div>

      <div className="flex-1 px-5 py-4 flex flex-col gap-4">
        {loading && (
          <div className="flex items-center gap-3 py-6 justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-[#22c55e] border-t-transparent animate-spin" />
            <span className="text-[12px] text-[#5a5a5a]">Tracing genealogy…</span>
          </div>
        )}

        {error && (
          <div className="px-3 py-2 rounded-md bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.3)] text-[12px] text-[#fca5a5] font-mono">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {ancestors.length > 0 && (
              <div>
                {label('Ancestors')}
                <div className="flex flex-col gap-1.5">
                  {ancestors.map(r => (
                    <Node key={r.id} row={r} materialName={materialMap[r.material_id] ?? r.batch_number} isCurrent={false} />
                  ))}
                </div>
              </div>
            )}

            {self && (
              <div>
                {label('Current Sub-batch')}
                <Node row={self} materialName={materialMap[self.material_id] ?? self.batch_number} isCurrent />
              </div>
            )}

            {descendants.length > 0 && (
              <div>
                {label('Descendants')}
                <div className="flex flex-col gap-1.5">
                  {descendants.map(r => (
                    <Node key={r.id} row={r} materialName={materialMap[r.material_id] ?? r.batch_number} isCurrent={false} />
                  ))}
                </div>
              </div>
            )}

            {isEmpty && (
              <div className="text-[12px] text-[#5a5a5a] italic">No parent or child batches recorded yet.</div>
            )}
            {notFound && (
              <div className="text-[12px] text-[#5a5a5a] italic">Batch not found in genealogy trace.</div>
            )}
          </>
        )}

        {/* Finished Lot — static placeholder until lot assignment is wired */}
        <div>
          {label('Finished Lot')}
          <div className="rounded-lg border border-[#1e1e1e] bg-[#0e0e0e] px-3 py-2.5">
            <span className="text-[12px] text-[#5a5a5a] italic">Not yet assigned</span>
          </div>
        </div>
      </div>
    </div>
  );
}
