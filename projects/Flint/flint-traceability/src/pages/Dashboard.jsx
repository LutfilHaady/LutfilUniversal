import ChartPlaceholder from '../components/ChartPlaceholder'
import KpiCard from '../components/KpiCard'
import { KPI } from '../data/mockData'

export default function Dashboard() {
  const exportReport = () => {
    window.alert('Export report (prototype — no file generated).')
  }

  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Operations · Liveboard</p>
        <h1 className="page-title-xl">Dashboard</h1>
        <p className="page-desc">
          Shift-level snapshot: WIP, quality, and throughput. Figures are
          representative placeholders for this UI prototype.
        </p>
      </div>

      <div className="grid-kpi">
        <KpiCard label="Active sub-batches (WIP)" value={KPI.activeSubBatchesWip} />
        <KpiCard label="Pass rate (7d)" value={`${KPI.passRate7d}%`} />
        <KpiCard label="Holds" value={KPI.holds} />
        <KpiCard label="QC checks today" value={KPI.qcChecksToday} />
        <KpiCard
          label="Avg cycle time"
          value={`${KPI.avgCycleTimeHours} h`}
          hint="rolling mean"
        />
        <KpiCard label="Rework rate" value={`${KPI.reworkRate}%`} />
        <KpiCard label="Scrap rate" value={`${KPI.scrapRate}%`} />
      </div>

      <div className="grid-charts">
        <ChartPlaceholder
          title="Status distribution"
          subtitle="WIP / Hold / Complete (mock)"
        />
        <ChartPlaceholder
          title="Production volume"
          subtitle="Units by day (mock)"
        />
        <ChartPlaceholder
          title="Top defects"
          subtitle="Pareto placeholder"
        />
      </div>

      <button type="button" className="btn-pill primary" onClick={exportReport}>
        Export report
      </button>
    </div>
  )
}
