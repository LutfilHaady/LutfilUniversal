import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrace } from '../context/TraceContext'

export default function ScanSearch() {
  const navigate = useNavigate()
  const { subBatches, units } = useTrace()
  const [batchId, setBatchId] = useState('')
  const [serial, setSerial] = useState('')
  const [errBatch, setErrBatch] = useState(false)
  const [errSerial, setErrSerial] = useState(false)

  const goSubBatch = () => {
    setErrBatch(false)
    const id = batchId.trim().toUpperCase()
    if (!id) return
    const found = subBatches.some((s) => s.id === id)
    if (!found) {
      setErrBatch(true)
      return
    }
    navigate(`/sub-batch/${encodeURIComponent(id)}`)
  }

  const goUnit = () => {
    setErrSerial(false)
    const s = serial.trim()
    if (!s) return
    if (!units[s]) {
      setErrSerial(true)
      return
    }
    navigate(`/unit/${encodeURIComponent(s)}`)
  }

  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Floor · Identification</p>
        <h1 className="page-title-xl">Scan / Search</h1>
        <p className="page-desc">
          Simulate scanning a sub-batch QR or looking up a unit serial. Try{' '}
          <span className="mono">A1</span> or <span className="mono">SN-2026-00010050</span>.
        </p>
      </div>

      <div className="split two">
        <div className="card">
          <h2>Scan Sub-batch QR</h2>
          <p className="muted small">
            Camera / scanner integration is not connected in this prototype.
          </p>
          <div className="scan-viewport">QR viewport placeholder</div>
          <label className="field">
            <span className="label-text">Sub-batch ID (manual)</span>
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="e.g. A1"
              className="mono"
            />
          </label>
          {errBatch ? (
            <div className="alert error" style={{ marginTop: '0.75rem' }}>
              Sub-batch not found. Check the ID and try again.
            </div>
          ) : null}
          <div className="row-actions">
            <button type="button" className="btn-pill primary" onClick={goSubBatch}>
              Open sub-batch
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Search by Unit Serial</h2>
          <p className="muted small">
            Resolves the finished lot and trace summary for a battery serial.
          </p>
          <label className="field">
            <span className="label-text">Unit serial</span>
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="e.g. SN-2026-00010050"
              className="mono"
            />
          </label>
          {errSerial ? (
            <div className="alert error" style={{ marginTop: '0.75rem' }}>
              Serial not found in prototype data. Use an existing serial or create
              one from a finished lot.
            </div>
          ) : null}
          <div className="row-actions">
            <button type="button" className="btn-pill primary" onClick={goUnit}>
              View unit detail
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
