import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../components/Modal'
import { useTrace } from '../context/TraceContext'

export default function FinishedLots() {
  const { finishedLots, subBatches, generateFinishedLot } = useTrace()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState(1000)
  const [pick, setPick] = useState(['A3'])
  const [toast, setToast] = useState('')

  const toggle = (id) => {
    setPick((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    )
  }

  const handleGen = () => {
    const lot = generateFinishedLot(pick.length ? pick : ['A3'], qty)
    setToast(`Created ${lot.id} (prototype).`)
    setOpen(false)
  }

  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Shipping · Lots</p>
        <h1 className="page-title-xl">Finished Lots</h1>
        <p className="page-desc">
          Box / tray / reel QR lots. Generating a lot is UI-only and updates
          session state.
        </p>
      </div>

      <div className="row-actions" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn-pill primary"
          onClick={() => setOpen(true)}
        >
          Generate Finished Lot
        </button>
        {toast ? <span className="toast-inline">{toast}</span> : null}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Lot ID</th>
              <th>Qty</th>
              <th>Date</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {finishedLots.map((l) => (
              <tr key={l.id}>
                <td className="mono">{l.id}</td>
                <td>{l.qty}</td>
                <td>{l.date}</td>
                <td>
                  <span className="badge ok">{l.status}</span>
                </td>
                <td>
                  <Link
                    to={`/finished-lot/${encodeURIComponent(l.id)}`}
                    className="btn-pill ghost small"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        title="Generate Finished Lot"
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-pill" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-pill primary" onClick={handleGen}>
              Generate
            </button>
          </>
        }
      >
        <label className="field">
          <span className="label-text">Quantity (units)</span>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </label>
        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          Contributing sub-batches (toggle)
        </p>
        <div className="row-actions">
          {subBatches.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`btn-pill${pick.includes(s.id) ? ' primary' : ''}`}
              onClick={() => toggle(s.id)}
            >
              {s.id}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
