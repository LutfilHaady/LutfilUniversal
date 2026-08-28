import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../components/Modal'
import { useTrace } from '../context/TraceContext'
import { getStepName } from '../data/steps'

export default function MainBatch() {
  const { mainInventory, subBatches, createSubBatch } = useTrace()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState(500)
  const [toast, setToast] = useState('')

  const handleCreate = () => {
    const id = createSubBatch(qty)
    setToast(`Created ${id} (${qty} units).`)
    setOpen(false)
  }

  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Material · MAIN-A</p>
        <h1 className="page-title-xl">Main Batch</h1>
        <p className="page-desc">
          Main Batch A inventory and sub-batches. Creating a sub-batch is UI-only
          and updates session state for this browser tab.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>{mainInventory.batchId}</h2>
        <p className="muted small">{mainInventory.material}</p>
        <p style={{ margin: '1rem 0 0', fontSize: '1.5rem', fontWeight: 700 }}>
          {mainInventory.remainingKg.toLocaleString()}{' '}
          <span className="muted" style={{ fontSize: '1rem', fontWeight: 500 }}>
            {mainInventory.unit} remaining
          </span>
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="btn-pill primary"
            onClick={() => setOpen(true)}
          >
            Create Sub-batch
          </button>
        </div>
        {toast ? <div className="toast-inline">{toast}</div> : null}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Sub-batches</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Qty</th>
                <th>Current step</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {subBatches.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.id}</td>
                  <td>{s.qty}</td>
                  <td>{getStepName(s.currentStepIndex)}</td>
                  <td>
                    <span
                      className={`badge ${
                        s.status === 'In Progress'
                          ? 'ok'
                          : s.status === 'Complete'
                            ? 'neutral'
                            : s.status === 'Hold'
                              ? 'hold'
                              : 'bad'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <Link to={`/sub-batch/${s.id}`} className="btn-pill ghost small">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        title="Create Sub-batch"
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-pill" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-pill primary" onClick={handleCreate}>
              Create
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
          Assigns the next ID (A4, A5, …) and starts at step 1 (Mixer).
        </p>
      </Modal>
    </div>
  )
}
