import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  INITIAL_FINISHED_LOTS,
  INITIAL_MAIN_INVENTORY,
  INITIAL_SUB_BATCHES,
  INITIAL_UNITS,
} from '../data/mockData'
import { STEP_COUNT } from '../data/steps'

const STORAGE_KEY = 'flint_trace_v1'

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveState(snapshot) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* ignore */
  }
}

function cloneSeed() {
  return {
    subBatches: structuredClone(INITIAL_SUB_BATCHES),
    finishedLots: structuredClone(INITIAL_FINISHED_LOTS),
    units: { ...INITIAL_UNITS },
    mainInventory: { ...INITIAL_MAIN_INVENTORY },
    nextSubBatchNum: 4,
    nextLotSeq: 43,
    nextSerialBlock: 12000,
  }
}

const TraceContext = createContext(null)

export function TraceProvider({ children }) {
  const persisted = loadState()
  const seed = cloneSeed()

  const [subBatches, setSubBatches] = useState(
    persisted?.subBatches ?? seed.subBatches,
  )
  const [finishedLots, setFinishedLots] = useState(
    persisted?.finishedLots ?? seed.finishedLots,
  )
  const [units, setUnits] = useState(persisted?.units ?? seed.units)
  const [mainInventory, setMainInventory] = useState(
    persisted?.mainInventory ?? seed.mainInventory,
  )
  const [nextSubBatchNum, setNextSubBatchNum] = useState(
    persisted?.nextSubBatchNum ?? seed.nextSubBatchNum,
  )
  const [nextLotSeq, setNextLotSeq] = useState(
    persisted?.nextLotSeq ?? seed.nextLotSeq,
  )
  const [nextSerialBlock, setNextSerialBlock] = useState(
    persisted?.nextSerialBlock ?? seed.nextSerialBlock,
  )

  useEffect(() => {
    saveState({
      subBatches,
      finishedLots,
      units,
      mainInventory,
      nextSubBatchNum,
      nextLotSeq,
      nextSerialBlock,
    })
  }, [
    subBatches,
    finishedLots,
    units,
    mainInventory,
    nextSubBatchNum,
    nextLotSeq,
    nextSerialBlock,
  ])

  const getSubBatch = useCallback(
    (id) => subBatches.find((s) => s.id === id) ?? null,
    [subBatches],
  )

  const createSubBatchSync = useCallback((qty) => {
    const q = Number(qty) || 0
    const id = `A${nextSubBatchNum}`
    const row = {
      id,
      qty: q,
      currentStepIndex: 0,
      status: 'In Progress',
      processLogs: [],
      qcLogs: [],
    }
    setSubBatches((prev) => [...prev, row])
    setNextSubBatchNum((n) => n + 1)
    setMainInventory((inv) => ({
      ...inv,
      remainingKg: Math.max(0, Math.round((inv.remainingKg - q * 0.4) * 10) / 10),
    }))
    return id
  }, [nextSubBatchNum])

  const setSubBatchStatus = useCallback((id, status) => {
    setSubBatches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    )
  }, [])

  /** After logging process step with Pass: move to next step or complete at Assembly */
  const advanceAfterPass = useCallback((id) => {
    setSubBatches((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        if (s.currentStepIndex >= STEP_COUNT - 1) {
          return { ...s, status: 'Complete' }
        }
        return {
          ...s,
          currentStepIndex: s.currentStepIndex + 1,
          status:
            s.status === 'Hold' || s.status === 'Rework'
              ? 'In Progress'
              : s.status,
        }
      }),
    )
  }, [])

  const addProcessLog = useCallback((id, entry) => {
    setSubBatches((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              processLogs: [
                ...s.processLogs,
                { ...entry, id: entry.id ?? `p-${Date.now()}` },
              ],
            }
          : s,
      ),
    )
  }, [])

  const addQcLog = useCallback((id, entry) => {
    setSubBatches((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              qcLogs: [
                ...s.qcLogs,
                { ...entry, id: entry.id ?? `q-${Date.now()}` },
              ],
            }
          : s,
      ),
    )
  }, [])

  const generateFinishedLot = useCallback(
    (subBatchIds, qty) => {
      const q = Math.max(0, Number(qty) || 0)
      const id = `LOT-2026-${String(nextLotSeq).padStart(4, '0')}`
      const start = nextSerialBlock
      const end = q > 0 ? start + q - 1 : start
      const row = {
        id,
        qty: q,
        date: new Date().toISOString().slice(0, 10),
        status: 'Released',
        subBatchIds: [...subBatchIds],
        serialPrefix: 'SN-2026',
        serialStartNum: start,
        serialEndNum: end,
      }
      setFinishedLots((prev) => [...prev, row])
      setNextLotSeq((n) => n + 1)
      setNextSerialBlock((b) => b + q)
      return row
    },
    [nextLotSeq, nextSerialBlock],
  )

  const registerUnitSerialsForLot = useCallback(
    (lotId, count, startNumOverride) => {
      const lot = finishedLots.find((l) => l.id === lotId)
      const start = startNumOverride ?? lot?.serialStartNum ?? nextSerialBlock
      const c = Math.max(0, Number(count) || 0)
      setUnits((prev) => {
        const next = { ...prev }
        for (let i = 0; i < c; i++) {
          const num = start + i
          const serial = `SN-2026-${String(num).padStart(8, '0')}`
          next[serial] = {
            serial,
            finishedLotId: lotId,
            qcSummary: [
              {
                label: 'Cell OCV',
                status: 'PASS',
                detail: 'Within spec (prototype)',
              },
              { label: 'Visual', status: 'PASS', detail: 'OK' },
            ],
            subBatchLineage: lot?.subBatchIds ?? [],
          }
        }
        return next
      })
    },
    [finishedLots, nextSerialBlock],
  )

  const resetDemo = useCallback(() => {
    const s = cloneSeed()
    setSubBatches(s.subBatches)
    setFinishedLots(s.finishedLots)
    setUnits(s.units)
    setMainInventory(s.mainInventory)
    setNextSubBatchNum(s.nextSubBatchNum)
    setNextLotSeq(s.nextLotSeq)
    setNextSerialBlock(s.nextSerialBlock)
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = useMemo(
    () => ({
      subBatches,
      finishedLots,
      units,
      mainInventory,
      getSubBatch,
      createSubBatch: createSubBatchSync,
      setSubBatchStatus,
      advanceAfterPass,
      addProcessLog,
      addQcLog,
      generateFinishedLot,
      registerUnitSerialsForLot,
      resetDemo,
    }),
    [
      subBatches,
      finishedLots,
      units,
      mainInventory,
      getSubBatch,
      createSubBatchSync,
      setSubBatchStatus,
      advanceAfterPass,
      addProcessLog,
      addQcLog,
      generateFinishedLot,
      registerUnitSerialsForLot,
      resetDemo,
    ],
  )

  return (
    <TraceContext.Provider value={value}>{children}</TraceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook paired with TraceProvider
export function useTrace() {
  const ctx = useContext(TraceContext)
  if (!ctx) throw new Error('useTrace must be used within TraceProvider')
  return ctx
}
