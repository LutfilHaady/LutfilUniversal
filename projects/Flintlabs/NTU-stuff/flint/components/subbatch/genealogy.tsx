import Link from 'next/link';
import { SUBBATCH_DETAIL, MAIN_BATCHES } from '@/lib/data';
import { StatusBadge } from '@/components/status-badge';
import { IconLink } from '@/components/icons';

const STATUS_DOT: Record<string, string> = {
  Released:   '#22c55e',
  InProgress: '#3b82f6',
  OnHold:     '#f59e0b',
  Quarantine: '#a855f7',
  Scrapped:   '#ef4444',
};

export function Genealogy() {
  const current = SUBBATCH_DETAIL;
  const parent = MAIN_BATCHES.find(b => b.id === current.parentId);
  const siblings = parent?.subBatches ?? [];

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Material Genealogy</span>
        <IconLink size={14} className="text-[#5a5a5a]" />
      </div>

      <div className="flex-1 px-5 py-4 flex flex-col gap-4">
        {/* MainBatch root node */}
        {parent && (
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-2">
              Main Batch
            </div>
            <div className="rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] px-3 py-2.5">
              <div className="font-mono text-[12.5px] text-[#f5f5f5]">{parent.id}</div>
              <div className="text-[11px] text-[#5a5a5a] mt-0.5">
                {parent.category} · {parent.qty} · {parent.supplier}
              </div>
            </div>

            {/* Tree connector + sub-batches */}
            <div className="ml-4 mt-1 flex flex-col">
              {siblings.map((sb, i) => {
                const isCurrent = sb.id === current.id;
                const isLast = i === siblings.length - 1;
                const dot = STATUS_DOT[sb.status] ?? '#5a5a5a';

                return (
                  <div key={sb.id} className="flex items-stretch">
                    {/* Tree line */}
                    <div className="flex flex-col items-center w-5 shrink-0">
                      <div className="w-px flex-1 bg-[#2a2a2a]" style={{ minHeight: 12 }} />
                      {isLast && <div className="w-px flex-1 bg-transparent" />}
                    </div>
                    {/* Horizontal arm */}
                    <div className="flex items-center">
                      <div className="w-3 h-px bg-[#2a2a2a] shrink-0" />
                    </div>

                    {/* Node */}
                    <div className={
                      'flex-1 my-1 rounded-lg border px-3 py-2 flex items-center justify-between gap-2 ' +
                      (isCurrent
                        ? 'border-[#22c55e]/50 bg-[rgba(34,197,94,0.05)]'
                        : 'border-[#1e1e1e] bg-[#0e0e0e]')
                    }>
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: dot }}
                        />
                        {isCurrent ? (
                          <span className="font-mono text-[11.5px] text-[#22c55e] truncate">{sb.id}</span>
                        ) : (
                          <Link
                            href={`/batches/${encodeURIComponent(sb.parentId)}/${encodeURIComponent(sb.id)}`}
                            className="font-mono text-[11.5px] text-[#93c5fd] hover:text-white transition-colors truncate"
                          >
                            {sb.id}
                          </Link>
                        )}
                        {isCurrent && (
                          <span className="text-[9.5px] font-mono text-[#22c55e] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.3)] px-1.5 py-0.5 rounded shrink-0">
                            current
                          </span>
                        )}
                      </div>
                      <StatusBadge status={sb.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Finished Lot */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-2">
            Finished Lot
          </div>
          <div className="rounded-lg border border-[#1e1e1e] bg-[#0e0e0e] px-3 py-2.5">
            <span className="text-[12px] text-[#5a5a5a] italic">Not yet assigned</span>
          </div>
        </div>
      </div>
    </div>
  );
}
