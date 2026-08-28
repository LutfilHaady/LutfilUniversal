import { useState } from 'react'

const TABS = [
  { id: 'batch', label: 'Batch Summary' },
  { id: 'qc', label: 'QC Analysis' },
  { id: 'defect', label: 'Defect Trends' },
  { id: 'compliance', label: 'Compliance' },
]

export default function Reports() {
  const [tab, setTab] = useState('batch')
  const [fmt, setFmt] = useState('pdf')
  const [from, setFrom] = useState('2026-03-01')
  const [to, setTo] = useState('2026-03-31')

  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Analytics · Export</p>
        <h1 className="page-title-xl">Reports</h1>
        <p className="page-desc">
          Report builder mock: filters and format toggles only; no generated file.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-grid two">
          <label className="field">
            <span className="label-text">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span className="label-text">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <span className="muted small" style={{ marginRight: '0.75rem' }}>
            Format
          </span>
          {['pdf', 'csv'].map((f) => (
            <button
              key={f}
              type="button"
              className={`btn-pill${fmt === f ? ' primary' : ''}`}
              style={{ marginRight: '0.35rem' }}
              onClick={() => setFmt(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {TABS.find((x) => x.id === tab)?.label}
        </h2>
        <div className="preview-box">
          Report preview placeholder ({from} → {to}, {fmt.toUpperCase()}).
          <br />
          <br />
          In production this area would render charts, tables, and compliance
          attestations from live data. This prototype shows layout only.
        </div>
        <div className="row-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn-pill primary"
            onClick={() =>
              window.alert('Generate report (prototype — no download).')
            }
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  )
}
