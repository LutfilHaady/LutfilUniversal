export default function ChartPlaceholder({ title, subtitle }) {
  return (
    <div className="card chart-placeholder">
      <div className="chart-ph-head">
        <h3 className="chart-ph-title">{title}</h3>
        {subtitle ? <p className="muted small">{subtitle}</p> : null}
      </div>
      <div className="chart-ph-body" aria-hidden>
        <div className="chart-ph-bars">
          {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
            <span key={i} className="chart-ph-bar" style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="chart-ph-note">Chart placeholder</p>
      </div>
    </div>
  )
}
