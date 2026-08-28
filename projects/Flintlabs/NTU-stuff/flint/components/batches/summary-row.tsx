import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { SubBatch } from '@/lib/data';

interface SummaryRowProps {
  subBatch: SubBatch;
}

export function SummaryRow({ subBatch: sb }: SummaryRowProps) {
  return (
    <tr className="hover:bg-[#141414] transition-colors">
      <td className="pl-10 pr-4 py-2.5">
        <Link
          href={`/batches/${encodeURIComponent(sb.parentId)}/${encodeURIComponent(sb.id)}`}
          className="font-mono text-[12px] text-[#93c5fd] hover:text-white transition-colors"
        >
          {sb.id}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-[12px] text-[#888888] font-mono">{sb.qty}</td>
      <td className="px-4 py-2.5 text-[12px] text-[#888888]">{sb.machine}</td>
      <td className="px-4 py-2.5 text-[12px] text-[#888888]">{sb.operator}</td>
      <td className="px-4 py-2.5 text-[12px] font-mono text-[#888888]">{sb.started}</td>
      <td className="px-4 py-2.5 text-[12px] font-mono">
        {sb.yield !== null ? (
          <span className={sb.yield >= 90 ? 'text-[#86efac]' : 'text-[#fca5a5]'}>
            {sb.yield.toFixed(1)}%
          </span>
        ) : (
          <span className="text-[#5a5a5a]">—</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={sb.status} />
      </td>
    </tr>
  );
}
