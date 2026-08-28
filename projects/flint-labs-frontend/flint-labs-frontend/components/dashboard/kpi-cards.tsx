import { IconActivity, IconBatches, IconCheck, IconAlert } from '@/components/icons'
import type { SubBatch } from '@/lib/types'

interface KpiCardsProps {
  subBatches: SubBatch[]
  qcPassRateSevenDay?: number
  firstPassYield?: number | null
  topDefect?: string | null
  activeAlertCount?: number
}

export function KpiCards({
  subBatches,
  qcPassRateSevenDay = 0,
  firstPassYield = null,
  topDefect = null,
  activeAlertCount = 0,
}: KpiCardsProps) {
  const inProgress = subBatches.filter(b => b.status === 'InProgress').length
  const onHold     = subBatches.filter(b => b.status === 'OnHold').length
  const released   = subBatches.filter(b => b.status === 'Released').length

  let qcAccent = '#22c55e'
  if (qcPassRateSevenDay < 80) qcAccent = '#f59e0b'
  if (qcPassRateSevenDay < 70) qcAccent = '#ef4444'

  let fpyAccent = '#22c55e'
  if (firstPassYield !== null && firstPassYield < 80) fpyAccent = '#f59e0b'
  if (firstPassYield !== null && firstPassYield < 70) fpyAccent = '#ef4444'

  const kpis = [
    {
      label: 'Active Sub-Batches',
      value: String(inProgress),
      sub: `${onHold} on hold`,
      positive: null as null,
      Icon: IconBatches,
      accent: '#3b82f6',
    },
    {
      label: 'On Hold',
      value: String(onHold),
      sub: onHold > 0 ? 'require attention' : 'none active',
      positive: onHold > 0 ? false : null as null,
      Icon: IconAlert,
      accent: onHold > 0 ? '#f59e0b' : '#5a5a5a',
    },
    {
      label: 'Released',
      value: String(released),
      sub: 'sub-batches',
      positive: null as null,
      Icon: IconCheck,
      accent: '#22c55e',
    },
    {
      label: 'QC Pass Rate (7d)',
      value: `${qcPassRateSevenDay}%`,
      sub: 'rolling average',
      positive: qcPassRateSevenDay >= 80 ? true : qcPassRateSevenDay >= 70 ? null : false,
      Icon: IconActivity,
      accent: qcAccent,
    },
    {
      label: 'First-Pass Yield (7d)',
      value: firstPassYield !== null ? `${firstPassYield}%` : 'Not yet available',
      sub: firstPassYield !== null ? 'runs passing all QC first time' : 'no run data yet',
      positive: firstPassYield === null ? null : firstPassYield >= 80 ? true : firstPassYield >= 70 ? null : false,
      Icon: IconActivity,
      accent: firstPassYield !== null ? fpyAccent : '#5a5a5a',
    },
    {
      label: 'Top Defect (7d)',
      value: topDefect ?? 'None',
      sub: topDefect ? 'most common QC failure' : 'no failures recorded',
      positive: topDefect ? false : (null as null),
      Icon: IconAlert,
      accent: topDefect ? '#ef4444' : '#5a5a5a',
    },
    {
      label: 'Active Alerts',
      value: String(activeAlertCount),
      sub: activeAlertCount > 0 ? 'unresolved alerts' : 'all clear',
      positive: activeAlertCount > 0 ? false : (null as null),
      Icon: IconAlert,
      accent: activeAlertCount > 0 ? '#f59e0b' : '#5a5a5a',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {kpis.map((k) => (
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
            style={{ color: k.positive === false ? '#ef4444' : k.positive === true ? '#22c55e' : '#888888' }}
          >
            {k.sub}
          </div>
        </div>
      ))}
    </div>
  )
}
