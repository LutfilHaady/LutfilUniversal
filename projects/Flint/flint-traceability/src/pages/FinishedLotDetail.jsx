import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Modal from '../components/Modal'
import { useTrace } from '../context/TraceContext'

export default function FinishedLotDetail() {
  const { id } = useParams()
  const { finishedLots, registerUnitSerialsForLot } = useTrace()
  const lot = finishedLots.find((l) => l.id === id)
  const [open, setOpen] = useState(false)
  const [genQty, setGenQty] = useState(200)
  const [note, setNote] = useState('')

  if (!lot) {
    return (
      <div className="card">
        <h1>Lot not found</h1>
        <Link to="/finished-lots">Back to Finished Lots</Link>
      </div>
    )
  }

  const startSerial = `SN-2026-${String(lot.serialStartNum).padStart(8, '0')}`
  const endSerial = `SN-2026-${String(lot.serialEndNum).padStart(8, '0')}`

  const previewRange = (n) => {
    const start = lot.serialStartNum
    const end = start + n - 1
    return {
      from: `SN-2026-${String(start).padStart(8, '0')}`,
      to: `SN-2026-${String(Math.max(start, end)).padStart(8, '0')}`,
    }
  }

  const pr = previewRange(genQty)

  const applySerials = () => {
    registerUnitSerialsForLot(lot.id, genQty, lot.serialStartNum)
    setNote(`Registered ${genQty} serial(s) in prototype store.`)
    setOpen(false)
  }

  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Finished lot · QR</p>
        <p className="muted small" style={{ margin: '0 0 0.35rem' }}>
          <Link to="/finished-lots">Finished Lots</Link>
        </p>
        <h1 className="page-title-xl mono">{lot.id}</h1>
      </div>

      <div className="card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
        <div className="qr-placeholder" aria-hidden />
        <p className="muted small">Finished Lot QR (placeholder)</p>
        <p style={{ marginTop: '0.5rem' }}>
          <strong>Qty:</strong> {lot.qty} · <strong>Date:</strong> {lot.date} ·{' '}
          <span className="badge ok">{lot.status}</span>
        </p>
        <p className="muted small">
          Serial block (assigned at lot creation):{' '}
          <span className="mono">{startSerial}</span> –{' '}
          <span className="mono">{endSerial}</span>
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Contributing sub-batches</h2>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {lot.subBatchIds.map((sid) => (
            <li key={sid} style={{ marginBottom: '0.35rem' }}>
              <Link to={`/sub-batch/${sid}`} className="mono">
                {sid}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="row-actions">
        <button
          type="button"
          className="btn-pill primary"
          onClick={() => setOpen(true)}
        >
          Generate Unit Serials
        </button>
      </div>
      {note ? <div className="toast-inline" style={{ marginTop: '0.75rem' }}>{note}</div> : null}

      <Modal
        title="Generate Unit Serials"
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-pill" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-pill primary" onClick={applySerials}>
              Register serials
            </button>
          </>
        }
      >
        <label className="field">
          <span className="label-text">Quantity</span>
          <input
            type="number"
            min={1}
            value={genQty}
            onChange={(e) => setGenQty(Number(e.target.value))}
          />
        </label>
        <div
          className="preview-box"
          style={{ marginTop: '1rem' }}
        >
          <strong>Preview range</strong>
          <p style={{ margin: '0.5rem 0 0' }} className="mono">
            {pr.from}
          </p>
          <p style={{ margin: '0.25rem 0 0' }} className="mono">
            … through …
          </p>
          <p style={{ margin: '0.25rem 0 0' }} className="mono">
            {pr.to}
          </p>
        </div>
        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          Prototype: registers serial keys in browser session for unit lookup.
        </p>
      </Modal>
    </div>
  )
}
