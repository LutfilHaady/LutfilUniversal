import { IconActivity, IconBatches, IconCheck, IconAlert } from '@/components/icons';

const KPI_DATA = [
  {
    label: 'Avg Yield',
    value: '94.6%',
    sub: '+0.8% vs yesterday',
    positive: true,
    Icon: IconActivity,
    accent: '#22c55e',
  },
  {
    label: 'Active Sub-Batches',
    value: '23',
    sub: '3 require attention',
    positive: null,
    Icon: IconBatches,
    accent: '#3b82f6',
  },
  {
    label: 'Produced Today',
    value: '14',
    sub: 'sub-batches completed',
    positive: null,
    Icon: IconCheck,
    accent: '#a855f7',
  },
  {
    label: 'Top Defect',
    value: 'Coating Skip',
    sub: '3 occurrences today',
    positive: false,
    Icon: IconAlert,
    accent: '#ef4444',
  },
];

export function KpiCards() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {KPI_DATA.map((k) => (
        <div
          key={k.label}
          className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#888888]">{k.label}</span>
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: `${k.accent}18`, border: `1px solid ${k.accent}33` }}
            >
              <k.Icon size={14} style={{ color: k.accent }} />
            </div>
          </div>
          <div className="text-[28px] font-semibold tracking-tight text-[#f5f5f5] leading-none">
            {k.value}
          </div>
          <div
            className="text-[11px]"
            style={{
              color:
                k.positive === true
                  ? '#22c55e'
                  : k.positive === false
                  ? '#ef4444'
                  : '#888888',
            }}
          >
            {k.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
