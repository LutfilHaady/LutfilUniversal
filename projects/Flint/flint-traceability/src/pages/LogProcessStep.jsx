import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTrace } from '../context/TraceContext'
import { getNextStepName, getStepName } from '../data/steps'

export default function LogProcessStep() {
  const [searchParams] = useSearchParams()
  const defaultId = searchParams.get('subBatch') ?? ''
  const {
    subBatches,
    getSubBatch,
    addProcessLog,
    advanceAfterPass,
    setSubBatchStatus,
  } = useTrace()

  const [selectedId, setSelectedId] = useState(defaultId)
  const sb = getSubBatch(selectedId)

  const [operator, setOperator] = useState('')
  const [machineId, setMachineId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [params, setParams] = useState('')
  const [outcome, setOutcome] = useState('Pass')
  const [toast, setToast] = useState('')

  const stepName = sb ? getStepName(sb.currentStepIndex) : '—'
  const nextStepName = sb ? getNextStepName(sb.currentStepIndex) : null

  const canSubmit = Boolean(sb && operator.trim() && machineId.trim())

  const passPreview = useMemo(() => {
    if (outcome !== 'Pass' || !sb) return null
    if (nextStepName) {
      return `Will advance to next step queue: ${nextStepName}`
    }
    return 'Will mark sub-batch complete at Assembly (end of line).'
  }, [outcome, sb, nextStepName])

  const submit = () => {
    if (!sb || !canSubmit) return
    const entry = {
      stepIndex: sb.currentStepIndex,
      stepName,
      operator: operator.trim(),
      machineId: machineId.trim(),
      outcome,
      at: new Date().toISOString(),
      notes: notes.trim(),
      parameters: params.trim(),
    }
    addProcessLog(sb.id, entry)

    if (outcome === 'Pass') {
      advanceAfterPass(sb.id)
    } else if (outcome === 'Hold') {
      setSubBatchStatus(sb.id, 'Hold')
    } else if (outcome === 'Rework') {
      setSubBatchStatus(sb.id, 'Rework')
    } else if (outcome === 'Scrap') {
      setSubBatchStatus(sb.id, 'Scrapped')
    }

    setToast(`Process log saved for ${sb.id} (${stepName}).`)
  }

  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Process · Execution</p>
        <p className="muted small" style={{ margin: '0 0 0.35rem' }}>
          <Link to="/main-batch">Main Batch</Link>
        </p>
        <h1 className="page-title-xl">Log Process Step</h1>
        <p className="page-desc">
          Step name always matches the sub-batch&apos;s current step (read-only).
          Only the active step can be logged for that sub-batch.
        </p>
      </div>

      <div className="card">
        <div className="form-grid two">
          <label className="field">
            <span className="label-text">Sub-batch</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Select…</option>
              {subBatches.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} — {getStepName(s.currentStepIndex)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label-text">Step (read-only)</span>
            <div className="readonly-step">{stepName}</div>
          </label>
        </div>

        {!sb ? (
          <p className="muted" style={{ marginTop: '1rem' }}>
            Select a sub-batch to load the current step.
          </p>
        ) : (
          <>
            <div className="form-grid two" style={{ marginTop: '1rem' }}>
              <label className="field">
                <span className="label-text">Operator</span>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  placeholder="Name or ID"
                />
              </label>
              <label className="field">
                <span className="label-text">Machine ID</span>
                <input
                  type="text"
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  placeholder="e.g. MX-01"
                  className="mono"
                />
              </label>
              <label className="field">
                <span className="label-text">Start time</span>
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="label-text">End time</span>
                <input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <label className="field" style={{ marginTop: '1rem' }}>
              <span className="label-text">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations"
              />
            </label>
            <label className="field" style={{ marginTop: '1rem' }}>
              <span className="label-text">Parameters (JSON or free text)</span>
              <textarea
                value={params}
                onChange={(e) => setParams(e.target.value)}
                placeholder='e.g. {"temp_c": 42, "speed": 1.2}'
                className="mono"
              />
            </label>

            <div style={{ marginTop: '1.25rem' }}>
              <div className="muted small" style={{ marginBottom: '0.5rem' }}>
                Outcome
              </div>
              <div className="row-actions">
                {['Pass', 'Hold', 'Rework', 'Scrap'].map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`btn-pill${outcome === o ? ' primary' : ''}`}
                    onClick={() => setOutcome(o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {outcome === 'Pass' && passPreview ? (
              <div className="alert success" style={{ marginTop: '1rem' }}>
                {passPreview}
              </div>
            ) : null}

            <div className="row-actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-pill primary"
                disabled={!canSubmit}
                onClick={submit}
              >
                Save log
              </button>
              {sb ? (
                <Link to={`/sub-batch/${sb.id}`} className="btn-pill">
                  View sub-batch
                </Link>
              ) : null}
            </div>
            {toast ? <div className="toast-inline">{toast}</div> : null}
          </>
        )}
      </div>
    </div>
  )
}
