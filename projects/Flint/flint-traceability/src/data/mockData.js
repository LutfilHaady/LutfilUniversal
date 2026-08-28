import { STEPS } from './steps'

/** Dashboard KPIs (static placeholders) */
export const KPI = {
  activeSubBatchesWip: 12,
  passRate7d: 98.2,
  holds: 3,
  qcChecksToday: 47,
  avgCycleTimeHours: 36.4,
  reworkRate: 1.1,
  scrapRate: 0.4,
}

export const INITIAL_MAIN_INVENTORY = {
  batchId: 'MAIN-A',
  material: 'Cathode slurry mix — Batch A',
  remainingKg: 8420,
  unit: 'kg',
}

function ts(hoursAgo) {
  const d = new Date()
  d.setHours(d.getHours() - hoursAgo)
  return d.toISOString()
}

/** Seed sub-batches at different pipeline positions */
export const INITIAL_SUB_BATCHES = [
  {
    id: 'A1',
    qty: 520,
    currentStepIndex: 2,
    status: 'In Progress',
    processLogs: [
      {
        id: 'p1',
        stepIndex: 0,
        stepName: STEPS[0],
        operator: 'J. Rivera',
        machineId: 'MX-01',
        outcome: 'Pass',
        at: ts(48),
        notes: 'Batch homogenized; viscosity in spec.',
      },
      {
        id: 'p2',
        stepIndex: 1,
        stepName: STEPS[1],
        operator: 'M. Chen',
        machineId: 'COAT-03',
        outcome: 'Pass',
        at: ts(30),
        notes: 'Coating weight nominal.',
      },
    ],
    qcLogs: [
      {
        id: 'q1',
        testType: 'Slurry solids',
        value: 52.1,
        unit: '%',
        outcome: 'PASS',
        at: ts(47),
        spec: '50–54%',
      },
    ],
  },
  {
    id: 'A2',
    qty: 480,
    currentStepIndex: 5,
    status: 'In Progress',
    processLogs: [
      {
        id: 'p1',
        stepIndex: 0,
        stepName: STEPS[0],
        operator: 'J. Rivera',
        machineId: 'MX-01',
        outcome: 'Pass',
        at: ts(72),
        notes: '',
      },
      {
        id: 'p2',
        stepIndex: 1,
        stepName: STEPS[1],
        operator: 'M. Chen',
        machineId: 'COAT-03',
        outcome: 'Pass',
        at: ts(60),
        notes: '',
      },
      {
        id: 'p3',
        stepIndex: 2,
        stepName: STEPS[2],
        operator: 'A. Okonkwo',
        machineId: 'CAL-02',
        outcome: 'Pass',
        at: ts(50),
        notes: 'Thickness aligned.',
      },
      {
        id: 'p4',
        stepIndex: 3,
        stepName: STEPS[3],
        operator: 'L. Park',
        machineId: 'SLIT-01',
        outcome: 'Pass',
        at: ts(40),
        notes: '',
      },
      {
        id: 'p5',
        stepIndex: 4,
        stepName: STEPS[4],
        operator: 'L. Park',
        machineId: 'CUT-02',
        outcome: 'Pass',
        at: ts(28),
        notes: '',
      },
    ],
    qcLogs: [
      {
        id: 'q1',
        testType: 'Electrode density',
        value: 3.42,
        unit: 'g/cm³',
        outcome: 'PASS',
        at: ts(55),
        spec: '3.35–3.50',
      },
    ],
  },
  {
    id: 'A3',
    qty: 600,
    currentStepIndex: 6,
    status: 'Complete',
    processLogs: [
      { id: 'p1', stepIndex: 0, stepName: STEPS[0], operator: 'J. Rivera', machineId: 'MX-01', outcome: 'Pass', at: ts(120), notes: '' },
      { id: 'p2', stepIndex: 1, stepName: STEPS[1], operator: 'M. Chen', machineId: 'COAT-03', outcome: 'Pass', at: ts(110), notes: '' },
      { id: 'p3', stepIndex: 2, stepName: STEPS[2], operator: 'A. Okonkwo', machineId: 'CAL-02', outcome: 'Pass', at: ts(100), notes: '' },
      { id: 'p4', stepIndex: 3, stepName: STEPS[3], operator: 'L. Park', machineId: 'SLIT-01', outcome: 'Pass', at: ts(90), notes: '' },
      { id: 'p5', stepIndex: 4, stepName: STEPS[4], operator: 'L. Park', machineId: 'CUT-02', outcome: 'Pass', at: ts(80), notes: '' },
      { id: 'p6', stepIndex: 5, stepName: STEPS[5], operator: 'S. Kim', machineId: 'DC-01', outcome: 'Pass', at: ts(70), notes: '' },
      { id: 'p7', stepIndex: 6, stepName: STEPS[6], operator: 'R. Patel', machineId: 'ASM-04', outcome: 'Pass', at: ts(60), notes: 'Lot ready for boxing.' },
    ],
    qcLogs: [
      { id: 'q1', testType: 'Cell OCV', value: 3.62, unit: 'V', outcome: 'PASS', at: ts(58), spec: '3.55–3.70' },
    ],
  },
]

export const INITIAL_FINISHED_LOTS = [
  {
    id: 'LOT-2026-0042',
    qty: 1180,
    date: '2026-03-28',
    status: 'Released',
    subBatchIds: ['A3'],
    serialPrefix: 'SN-2026',
    serialStartNum: 10000,
    serialEndNum: 11179,
  },
  {
    id: 'LOT-2026-0038',
    qty: 950,
    date: '2026-03-22',
    status: 'Released',
    subBatchIds: ['A2'],
    serialPrefix: 'SN-2026',
    serialStartNum: 8800,
    serialEndNum: 9749,
  },
]

/** serial -> unit record */
export const INITIAL_UNITS = {
  'SN-2026-00010050': {
    serial: 'SN-2026-00010050',
    finishedLotId: 'LOT-2026-0042',
    qcSummary: [
      { label: 'Cell OCV', status: 'PASS', detail: '3.62 V (spec 3.55–3.70)' },
      { label: 'Visual inspection', status: 'PASS', detail: 'No defects' },
      { label: 'Leak test', status: 'PASS', detail: 'Pass' },
    ],
    subBatchLineage: ['A3'],
  },
  'SN-2026-00010401': {
    serial: 'SN-2026-00010401',
    finishedLotId: 'LOT-2026-0042',
    qcSummary: [
      { label: 'Cell OCV', status: 'PASS', detail: '3.58 V' },
      { label: 'Dimensional', status: 'PASS', detail: 'Within tolerance' },
    ],
    subBatchLineage: ['A3'],
  },
}

/** QC test definitions for Log QC page */
export const QC_TEST_TYPES = [
  { id: 'solids', label: 'Slurry solids', unit: '%', specMin: 50, specMax: 54, specLabel: '50–54%' },
  { id: 'density', label: 'Electrode density', unit: 'g/cm³', specMin: 3.35, specMax: 3.5, specLabel: '3.35–3.50' },
  { id: 'thickness', label: 'Coated thickness', unit: 'µm', specMin: 120, specMax: 135, specLabel: '120–135 µm' },
  { id: 'ocv', label: 'Cell OCV', unit: 'V', specMin: 3.55, specMax: 3.7, specLabel: '3.55–3.70' },
]

export const RECALL_MOCK_ROWS = [
  {
    defect: 'Separator wrinkle (Zone B)',
    impactedSubBatches: 'A1, A2',
    impactedLots: 'LOT-2026-0042 (partial)',
    action: 'Quarantine pending sort',
  },
  {
    defect: 'Low electrolyte fill (station ASM-04)',
    impactedSubBatches: 'A3',
    impactedLots: 'LOT-2026-0042',
    action: 'Recall initiated — see genealogy',
  },
  {
    defect: 'Calibration drift — Die Cutting DC-01',
    impactedSubBatches: 'A2',
    impactedLots: '— (WIP)',
    action: 'Hold all outputs from DC-01 2026-03-29 shift',
  },
]
