import { RECALL_MOCK_ROWS } from '../data/mockData'

export default function Recall() {
  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Containment · Genealogy</p>
        <h1 className="page-title-xl">Recall</h1>
        <p className="page-desc">
          Mock impact analysis: which sub-batches and finished lots could be affected
          if a defect pattern is confirmed.
        </p>
      </div>

      <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Defect / signal</th>
              <th>Impacted sub-batches</th>
              <th>Impacted lots</th>
              <th>Recommended action</th>
            </tr>
          </thead>
          <tbody>
            {RECALL_MOCK_ROWS.map((row) => (
              <tr key={row.defect}>
                <td>{row.defect}</td>
                <td className="mono">{row.impactedSubBatches}</td>
                <td>{row.impactedLots}</td>
                <td>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Genealogy (placeholder)</h2>
        <p className="muted small">
          Visual lineage from material → sub-batch → finished lot → serial range.
        </p>
        <div className="genealogy">
          [ Main-A ] → [ A1, A2, A3 ] → [ LOT-2026-0042 ] → [ SN-2026-00010000 … ]
        </div>
      </div>
    </div>
  )
}
