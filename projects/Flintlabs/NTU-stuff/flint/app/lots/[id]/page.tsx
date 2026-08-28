import Link from 'next/link';
import { Shell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import { IconChevronRight, IconQR, IconPrint } from '@/components/icons';
import { LOTS, SUB_BATCHES } from '@/lib/data';

// Mock: always show first lot. Real app would use params.id to look up.
export default function LotDetailPage() {
  const lot = LOTS[0];

  const breadcrumb = (
    <div className="flex items-center gap-2 min-w-0">
      <Link href="/lots" className="text-[#888888] hover:text-[#f5f5f5] text-[13px] font-medium transition-colors">Lots</Link>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[#5a5a5a] shrink-0"><path d="m9 18 6-6-6-6"/></svg>
      <span className="font-mono text-[12.5px] text-[#f5f5f5] truncate">{lot.id}</span>
    </div>
  );

  return (
    <Shell titleNode={breadcrumb}>
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">

        {/* Header card */}
        <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-[#5a5a5a] mb-1">Finished Lot</div>
              <div className="text-[20px] font-semibold font-mono tracking-tight text-[#f5f5f5]">{lot.id}</div>
              <div className="mt-1 text-[12px] text-[#888888]">{lot.batteryType} · {lot.unitCount} units · Created {lot.createdAt}</div>
              <div className="mt-0.5 text-[12px] text-[#888888]">Storage: <span className="font-mono">{lot.storageLocation}</span></div>
              <div className="mt-2">
                <StatusBadge status={lot.status} />
              </div>
            </div>

            {/* QR placeholder + actions */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="w-24 h-24 rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] flex items-center justify-center">
                <IconQR size={40} className="text-[#3a3a3a]" />
              </div>
              <div className="flex gap-1.5">
                <button className="h-8 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[11.5px] text-[#888888] hover:text-[#f5f5f5] flex items-center gap-1.5 transition-colors">
                  <IconPrint size={13} /> Print QR
                </button>
                <button className="h-8 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[11.5px] text-[#888888] hover:text-[#f5f5f5] flex items-center gap-1.5 transition-colors">
                  Download QR
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr minmax(0,320px)' }}>
          {/* Unit list */}
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#f5f5f5]">Serialized Units</span>
              <span className="text-[11px] font-mono text-[#5a5a5a]">{lot.units.length} units</span>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['Unit Serial', 'Source Sub-batch', 'QR', 'Created'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {lot.units.map(u => (
                  <tr key={u.serial} className="hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-2.5 font-mono text-[12px] text-[#f5f5f5]">{u.serial}</td>
                    <td className="px-5 py-2.5 font-mono text-[12px] text-[#93c5fd]">
                      <Link href={`/batches/${u.subBatchId.split('-').slice(0,4).join('-')}/${u.subBatchId}`} className="hover:text-white transition-colors">
                        {u.subBatchId}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5">
                      <IconQR size={14} className="text-[#5a5a5a]" />
                    </td>
                    <td className="px-5 py-2.5 text-[12px] font-mono text-[#888888]">{u.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Source sub-batches — material streams */}
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden self-start">
            <div className="px-5 py-3 border-b border-[#2a2a2a]">
              <div className="text-[13px] font-semibold text-[#f5f5f5]">Source Sub-Batches</div>
              <div className="text-[11px] text-[#5a5a5a] mt-0.5">Material streams assembled into this lot</div>
            </div>
            <div className="flex flex-col divide-y divide-[#1a1a1a]">
              {lot.sourceSubBatches.map(id => {
                const sb = SUB_BATCHES.find(s => s.id === id);
                return (
                  <Link
                    key={id}
                    href={`/batches/${id.split('-').slice(0, 4).join('-')}/${id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-[#141414] transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] text-[#93c5fd] group-hover:text-white transition-colors truncate">{id}</div>
                      {sb && (
                        <div className="text-[11px] text-[#5a5a5a] mt-0.5">{sb.category} · {sb.qty}</div>
                      )}
                    </div>
                    <IconChevronRight size={14} className="text-[#5a5a5a] shrink-0 ml-2" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

      </main>
    </Shell>
  );
}
