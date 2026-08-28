import { Link, useParams } from 'react-router-dom'
import { useTrace } from '../context/TraceContext'

export default function UnitDetail() {
  const { serial } = useParams()
  const decoded = decodeURIComponent(serial ?? '')
  const { units } = useTrace()
  const u = units[decoded]

  if (!u) {
    return (
      <div className="card">
        <h1>Unit not found</h1>
        <p className="muted">
          No prototype record for <span className="mono">{decoded}</span>.
        </p>
        <Link to="/scan">Back to Scan / Search</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Unit · Serialization</p>
        <p className="muted small" style={{ margin: '0 0 0.35rem' }}>
          <Link to="/scan">Scan / Search</Link>
        </p>
        <h1 className="page-title-xl">
          Unit <span className="mono">{u.serial}</span>
        </h1>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <p style={{ margin: 0 }}>
          <strong>Belongs to Finished Lot:</strong>{' '}
          <Link to={`/finished-lot/${encodeURIComponent(u.finishedLotId)}`} className="mono">
            {u.finishedLotId}
          </Link>
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Traceability summary</h2>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {u.qcSummary.map((row) => (
            <li key={row.label} style={{ marginBottom: '0.5rem' }}>
              <strong>{row.label}:</strong>{' '}
              <span
                className={`badge ${row.status === 'PASS' ? 'ok' : 'bad'}`}
              >
                {row.status}
              </span>
              <span className="muted small"> — {row.detail}</span>
            </li>
          ))}
        </ul>
        {u.subBatchLineage?.length ? (
          <p className="muted small" style={{ marginTop: '1rem' }}>
            Lineage sub-batches:{' '}
            {u.subBatchLineage.map((sid, i) => (
              <span key={sid}>
                {i > 0 ? ', ' : null}
                <Link to={`/sub-batch/${sid}`} className="mono">
                  {sid}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Recall & containment</h2>
        <p className="muted small">
          If this unit class is implicated in a defect investigation, use the recall
          workspace to see impacted scope.
        </p>
        <Link to="/recall" className="btn-pill primary">
          Open Recall workspace
        </Link>
      </div>
    </div>
  )
}
