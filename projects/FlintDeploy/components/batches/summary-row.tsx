import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import type { SubBatch } from '@/lib/types';

interface SummaryRowProps {
  subBatch: SubBatch;
}

export function SummaryRow({ subBatch: sb }: SummaryRowProps) {
  const qty = sb.current_quantity != null
    ? `${sb.current_quantity} ${sb.unit ?? ''}`.trim()
    : '—'

  return (
    <tr className="hover:bg-[#141414] transition-colors">
      <td className="pl-10 pr-4 py-2.5">
        <Link
          href={`/batches/${encodeURIComponent(sb.parent_batch_id ?? '')}/${encodeURIComponent(sb.id)}`}
          className="font-mono text-[12px] text-[#93c5fd] hover:text-white transition-colors"
        >
          {sb.batch_number}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-[12px] font-mono text-[#888888]">{qty}</td>
      <td className="px-4 py-2.5 text-[12px] text-[#888888] max-md:hidden">
        {sb.current_location ?? <span className="text-[#5a5a5a]">—</span>}
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={sb.status} />
      </td>
      <td className="px-4 py-2.5 text-[12px] text-[#888888] max-md:hidden">—</td>
    </tr>
  );
}
