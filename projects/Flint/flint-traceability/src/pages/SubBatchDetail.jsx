import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Stepper from '../components/Stepper'
import { useTrace } from '../context/TraceContext'
import { getNextStepName, getStepName } from '../data/steps'

export default function SubBatchDetail() {
  const { id } = useParams()
  const {
    getSubBatch,
    setSubBatchStatus,
    advanceAfterPass,
  } = useTrace()
  const [msg, setMsg] = useState('')

  const sb = getSubBatch(id)

  const timeline = useMemo(() => {
    if (!sb) return []
    const items = []
    sb.processLogs.forEach((p) => {
      items.push({
        kind: 'process',
        at: p.at,
        title: `${p.stepName} — ${p.outcome}`,
        meta: `${p.operator} · ${p.machineId}`,
        body: [p.notes, p.parameters].filter(Boolean).join('\n'),
      })
    })
    sb.qcLogs.forEach((q) => {
      items.push({
        kind: 'qc',
        at: q.at,
        title: `${q.testType}: ${q.value} ${q.unit} (${q.outcome})`,
        meta: `Spec ${q.spec}`,
        body: '',
      })
    })
    items.sort((a, b) => new Date(a.at) - new Date(b.at))
    return items
  }, [sb])

  if (!sb) {
    return (
      <div className="card">
        <h1>Sub-batch not found</h1>
        <p className="muted">No record for <span className="mono">{id}</span>.</p>
        <Link to="/scan">Back to Scan / Search</Link>
      </div>
    )
  }

  const current = getStepName(sb.currentStepIndex)
  const next = getNextStepName(sb.currentStepIndex)

  const quickAction = (label, fn) => {
    fn()
    setMsg(`${label} recorded (prototype).`)
  }

  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Trace · Sub-batch</p>
        <p className="muted small" style={{ margin: '0 0 0.35rem' }}>
          <Link to="/main-batch">Main Batch</Link>
          {' · '}
          <Link to="/scan">Scan</Link>
        </p>
        <h1 className="page-title-xl">
          Sub-batch <span className="mono">{sb.id}</span>
        </h1>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="muted small">Sub-batch ID</div>
            <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 600 }}>
              {sb.id}
            </div>
            <div style={{ marginTop: '0.75rem' }} className="muted small">
              Quantity
            </div>
            <div>{sb.qty} units</div>
          </div>
          <div>
            <span
              className={`badge ${
                sb.status === 'In Progress'
                  ? 'ok'
                  : sb.status === 'Complete'
                    ? 'neutral'
                    : sb.status === 'Hold'
                      ? 'hold'
                      : 'bad'
              }`}
            >
              {sb.status}
            </span>
          </div>
        </div>
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: 0 }}>
            <strong>Current step:</strong> {current}
          </p>
          <p style={{ margin: '0.35rem 0 0' }} className="muted">
            <strong>Next:</strong> {next ?? '— (end of line)'}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Linear progress</h2>
        <Stepper currentIndex={sb.currentStepIndex} />
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Timeline</h2>
        <div className="timeline">
          {timeline.length === 0 ? (
            <p className="muted">No logs yet.</p>
          ) : (
            timeline.map((t, i) => (
              <div
                key={`${t.at}-${i}`}
                className={`timeline-item ${t.kind === 'qc' ? 'qc' : 'process'}`}
              >
                <div className="timeline-meta">
                  {new Date(t.at).toLocaleString()} · {t.kind.toUpperCase()}
                </div>
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div className="muted small">{t.meta}</div>
                {t.body ? <p style={{ margin: '0.35rem 0 0' }}>{t.body}</p> : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Actions</h2>
        <div className="row-actions">
          <Link
            to={`/log-process?subBatch=${encodeURIComponent(sb.id)}`}
            className="btn-pill primary"
          >
            Log Current Step
          </Link>
          <Link
            to={`/log-qc?subBatch=${encodeURIComponent(sb.id)}`}
            className="btn-pill"
          >
            Log QC
          </Link>
          <button
            type="button"
            className="btn-pill"
            disabled={sb.status === 'Complete' || sb.status === 'Scrapped'}
            onClick={() => {
              advanceAfterPass(sb.id)
              setMsg('Moved to next step (Pass).')
            }}
          >
            Move to Next Step (Pass)
          </button>
          <button
            type="button"
            className="btn-pill warn"
            onClick={() =>
              quickAction('Hold', () => setSubBatchStatus(sb.id, 'Hold'))
            }
          >
            Hold
          </button>
          <button
            type="button"
            className="btn-pill warn"
            onClick={() =>
              quickAction('Rework', () => setSubBatchStatus(sb.id, 'Rework'))
            }
          >
            Rework
          </button>
          <button
            type="button"
            className="btn-pill danger"
            onClick={() =>
              quickAction('Scrap', () => setSubBatchStatus(sb.id, 'Scrapped'))
            }
          >
            Scrap
          </button>
        </div>
        {msg ? <div className="toast-inline">{msg}</div> : null}
      </div>
    </div>
  )
}
