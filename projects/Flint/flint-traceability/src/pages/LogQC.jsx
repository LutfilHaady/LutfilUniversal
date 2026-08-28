import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTrace } from '../context/TraceContext'
import { QC_TEST_TYPES } from '../data/mockData'
import { getStepName } from '../data/steps'

function evaluatePassFail(testId, rawValue) {
  const def = QC_TEST_TYPES.find((t) => t.id === testId)
  if (!def) return null
  const v = parseFloat(String(rawValue).replace(',', '.'))
  if (Number.isNaN(v)) return null
  if (v >= def.specMin && v <= def.specMax) return 'PASS'
  return 'FAIL'
}

export default function LogQC() {
  const [searchParams] = useSearchParams()
  const defaultId = searchParams.get('subBatch') ?? ''
  const { subBatches, getSubBatch, addQcLog } = useTrace()

  const [selectedId, setSelectedId] = useState(defaultId)
  const [testId, setTestId] = useState(QC_TEST_TYPES[0].id)
  const [value, setValue] = useState('52.0')
  const [toast, setToast] = useState('')

  const sb = getSubBatch(selectedId)
  const testDef = QC_TEST_TYPES.find((t) => t.id === testId)

  const result = useMemo(
    () => evaluatePassFail(testId, value),
    [testId, value],
  )

  const submit = () => {
    if (!sb || !testDef || result === null) return
    addQcLog(sb.id, {
      testType: testDef.label,
      value: parseFloat(String(value).replace(',', '.')),
      unit: testDef.unit,
      outcome: result,
      at: new Date().toISOString(),
      spec: testDef.specLabel,
    })
    setToast(`QC logged for ${sb.id}: ${result}`)
  }

  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Quality · Verification</p>
        <p className="muted small" style={{ margin: '0 0 0.35rem' }}>
          <Link to="/main-batch">Main Batch</Link>
        </p>
        <h1 className="page-title-xl">Log QC</h1>
        <p className="page-desc">
          Pick a sub-batch and enter a measurement. Pass/fail is computed against
          the spec range (prototype logic).
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
                  {s.id} @ {getStepName(s.currentStepIndex)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label-text">Test type</span>
            <select
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
            >
              {QC_TEST_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {testDef ? (
          <>
            <div className="form-grid two" style={{ marginTop: '1rem' }}>
              <label className="field">
                <span className="label-text">Value</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mono"
                />
              </label>
              <label className="field">
                <span className="label-text">Units</span>
                <input type="text" readOnly value={testDef.unit} className="mono" />
              </label>
            </div>
            <p style={{ marginTop: '1rem' }}>
              <strong>Spec range:</strong>{' '}
              <span className="mono">{testDef.specLabel}</span>
            </p>
            <div style={{ marginTop: '1rem' }}>
              <div className="muted small">Indicator</div>
              {result === null ? (
                <p className="muted">Enter a numeric value.</p>
              ) : (
                <div
                  className={`pass-fail ${result === 'PASS' ? 'pass' : 'fail'}`}
                >
                  {result}
                </div>
              )}
            </div>
            <div className="row-actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-pill primary"
                disabled={!sb || result === null}
                onClick={submit}
              >
                Save QC log
              </button>
              {sb ? (
                <Link to={`/sub-batch/${sb.id}`} className="btn-pill">
                  View sub-batch
                </Link>
              ) : null}
            </div>
            {toast ? <div className="toast-inline">{toast}</div> : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
