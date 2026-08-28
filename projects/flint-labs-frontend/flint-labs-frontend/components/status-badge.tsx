import { ALL_STATUS_TONES } from '@/lib/constants';

export function StatusBadge({ status }: { status: string }) {
  const t = ALL_STATUS_TONES[status];
  if (!t) return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border border-[#2a2a2a] text-[#888888] bg-[#1a1a1a]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#5a5a5a]" />
      {status}
    </span>
  );
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border"
      style={{ background: t.bg, color: t.fg, borderColor: t.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />
      {t.label}
    </span>
  );
}
