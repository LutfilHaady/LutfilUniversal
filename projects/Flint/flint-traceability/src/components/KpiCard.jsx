export default function KpiCard({ label, value, hint }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint ? <div className="kpi-hint muted">{hint}</div> : null}
    </div>
  )
}
