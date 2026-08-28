// ── Status enums (exact backend values) ─────────────────────────────

export type BatchStatus =
  | 'InProgress'
  | 'Released'
  | 'OnHold'
  | 'Quarantine'
  | 'Scrapped';

export type ProcessRunStatus =
  | 'InProgress'
  | 'AwaitingQC'
  | 'Passed'
  | 'Failed'
  | 'Overridden';

// Legacy alias — components can import either name
export type SubBatchStatus = BatchStatus;

// Valid status transitions (enforced in UI)
export const BATCH_STATUS_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  InProgress: ['Released', 'OnHold', 'Quarantine', 'Scrapped'],
  OnHold:     ['Released', 'Quarantine', 'Scrapped'],
  Quarantine: ['Released', 'Scrapped'],
  Released:   [], // terminal
  Scrapped:   [], // terminal
};

export const TERMINAL_STATUSES: BatchStatus[] = ['Released', 'Scrapped'];

// ── Display tokens ───────────────────────────────────────────────────

interface StatusTone {
  bg: string;
  border: string;
  fg: string;
  dot: string;
  label: string;
}

export const BATCH_STATUS_TONES: Record<BatchStatus, StatusTone> = {
  InProgress: { bg: 'rgba(59,130,246,.12)',  border: 'rgba(59,130,246,.35)',  fg: '#93c5fd', dot: '#3b82f6', label: 'In Progress' },
  Released:   { bg: 'rgba(34,197,94,.12)',   border: 'rgba(34,197,94,.35)',   fg: '#86efac', dot: '#22c55e', label: 'Released'    },
  OnHold:     { bg: 'rgba(245,158,11,.12)',  border: 'rgba(245,158,11,.35)',  fg: '#fcd34d', dot: '#f59e0b', label: 'On Hold'     },
  Quarantine: { bg: 'rgba(168,85,247,.12)',  border: 'rgba(168,85,247,.35)',  fg: '#d8b4fe', dot: '#a855f7', label: 'Quarantine'  },
  Scrapped:   { bg: 'rgba(239,68,68,.12)',   border: 'rgba(239,68,68,.35)',   fg: '#fca5a5', dot: '#ef4444', label: 'Scrapped'    },
};

export const PROCESS_RUN_STATUS_TONES: Record<ProcessRunStatus, StatusTone> = {
  InProgress: { bg: 'rgba(59,130,246,.12)',  border: 'rgba(59,130,246,.35)',  fg: '#93c5fd', dot: '#3b82f6', label: 'In Progress' },
  AwaitingQC: { bg: 'rgba(6,182,212,.12)',   border: 'rgba(6,182,212,.35)',   fg: '#67e8f9', dot: '#06b6d4', label: 'Awaiting QC' },
  Passed:     { bg: 'rgba(34,197,94,.12)',   border: 'rgba(34,197,94,.35)',   fg: '#86efac', dot: '#22c55e', label: 'Passed'      },
  Failed:     { bg: 'rgba(239,68,68,.12)',   border: 'rgba(239,68,68,.35)',   fg: '#fca5a5', dot: '#ef4444', label: 'Failed'      },
  Overridden: { bg: 'rgba(249,115,22,.12)',  border: 'rgba(249,115,22,.35)',  fg: '#fdba74', dot: '#f97316', label: 'Overridden'  },
};

// Combined lookup for StatusBadge (handles both enums)
export const ALL_STATUS_TONES: Record<string, StatusTone> = {
  ...BATCH_STATUS_TONES,
  ...PROCESS_RUN_STATUS_TONES,
};

// Legacy — kept so existing components that import STATUS_TONES don't break
export const STATUS_TONES = BATCH_STATUS_TONES;

// ── Core interfaces ──────────────────────────────────────────────────

export interface SubBatch {
  id: string;
  parentId: string;
  category: string;
  qty: string;
  machine: string;
  operator: string;
  status: BatchStatus;
  started: string;
  yield: number | null;
}

export interface MainBatch {
  id: string;
  category: string;
  qty: string;
  remaining: string;
  remainingPct: number;
  supplier: string;
  received: string;
  subBatches: SubBatch[];
}

// ── Mock data ────────────────────────────────────────────────────────

export const YIELD_TREND = [
  { day: 'Apr 24', yield: 93.1 },
  { day: 'Apr 25', yield: 91.8 },
  { day: 'Apr 26', yield: 94.2 },
  { day: 'Apr 27', yield: 92.5 },
  { day: 'Apr 28', yield: 95.1 },
  { day: 'Apr 29', yield: 93.8 },
  { day: 'Apr 30', yield: 94.6 },
];

export const ALERTS = [
  { id: 'A1', severity: 'critical' as const, message: 'Coating QC failed — MIXC-20260430-A01-03', time: '11:42', batch: 'MIXC-20260430-A01-03' },
  { id: 'A2', severity: 'warning'  as const, message: 'CAL-02 calibration due in 2 hours',         time: '10:15', batch: null },
  { id: 'A3', severity: 'warning'  as const, message: 'SLIT-20260430-B02-01 placed on hold',        time: '09:33', batch: 'SLIT-20260430-B02-01' },
];

export const SUB_BATCHES: SubBatch[] = [
  { id: 'MIXC-20260430-A01-03', parentId: 'MIXC-20260430-A01', category: 'Cathode Electrode', qty: '12.5 kg', machine: 'Coating Line A',  operator: 'L. Tan',   status: 'InProgress', started: '09:14', yield: null },
  { id: 'CALN-20260430-A01-02', parentId: 'CALN-20260430-A01', category: 'Anode Electrode',   qty: '10.0 kg', machine: 'Calendaring B',   operator: 'R. Mehta', status: 'InProgress', started: '08:50', yield: null },
  { id: 'SLIT-20260430-B02-01', parentId: 'SLIT-20260430-B02', category: 'Separator',         qty: '8.2 kg',  machine: 'Slitting Line 1', operator: 'J. Park',  status: 'OnHold',     started: '07:30', yield: null },
  { id: 'MIXC-20260429-A01-04', parentId: 'MIXC-20260429-A01', category: 'Cathode Electrode', qty: '11.8 kg', machine: 'Coating Line B',  operator: 'L. Tan',   status: 'Released',   started: '22:10', yield: 96.2 },
  { id: 'CALN-20260429-B01-01', parentId: 'CALN-20260429-B01', category: 'Anode Electrode',   qty: '9.5 kg',  machine: 'Calendaring A',   operator: 'K. Chen',  status: 'Released',   started: '21:45', yield: 94.1 },
  { id: 'MIXC-20260429-A01-03', parentId: 'MIXC-20260429-A01', category: 'Cathode Electrode', qty: '12.0 kg', machine: 'Coating Line A',  operator: 'R. Mehta', status: 'OnHold',     started: '19:20', yield: 88.3 },
  { id: 'SLIT-20260429-C01-02', parentId: 'SLIT-20260429-C01', category: 'Separator',         qty: '7.8 kg',  machine: 'Slitting Line 2', operator: 'J. Park',  status: 'Released',   started: '18:55', yield: 97.4 },
  { id: 'MIXC-20260429-A01-02', parentId: 'MIXC-20260429-A01', category: 'Cathode Electrode', qty: '11.5 kg', machine: 'Coating Line B',  operator: 'L. Tan',   status: 'Released',   started: '16:30', yield: 93.8 },
  { id: 'CALN-20260429-A01-03', parentId: 'CALN-20260429-A01', category: 'Anode Electrode',   qty: '10.2 kg', machine: 'Calendaring B',   operator: 'K. Chen',  status: 'Released',   started: '15:10', yield: 95.0 },
  { id: 'MIXC-20260429-B02-01', parentId: 'MIXC-20260429-B02', category: 'Cathode Electrode', qty: '12.8 kg', machine: 'Coating Line A',  operator: 'R. Mehta', status: 'Scrapped',   started: '13:40', yield: 71.2 },
  { id: 'SLIT-20260429-A01-01', parentId: 'SLIT-20260429-A01', category: 'Separator',         qty: '8.0 kg',  machine: 'Slitting Line 1', operator: 'J. Park',  status: 'Released',   started: '12:05', yield: 96.8 },
  { id: 'CALN-20260429-B01-02', parentId: 'CALN-20260429-B01', category: 'Anode Electrode',   qty: '9.8 kg',  machine: 'Calendaring A',   operator: 'L. Tan',   status: 'Released',   started: '10:50', yield: 94.5 },
  { id: 'MIXC-20260429-A01-01', parentId: 'MIXC-20260429-A01', category: 'Cathode Electrode', qty: '11.2 kg', machine: 'Coating Line B',   operator: 'K. Chen', status: 'Released', started: '08:20', yield: 95.7 },
  { id: 'FILL-20260429-A01-01', parentId: 'FILL-20260429-A01', category: 'Electrolyte',       qty: '5.0 kg',  machine: 'Filling Station 1', operator: 'K. Chen', status: 'Released', started: '10:00', yield: 98.1 },
  { id: 'SLIT-20260429-B01-01', parentId: 'SLIT-20260429-B01', category: 'Separator',         qty: '8.5 kg',  machine: 'Slitting Line 2',  operator: 'J. Park', status: 'Released', started: '09:30', yield: 96.0 },
  { id: 'ASSY-20260429-A01-01', parentId: 'ASSY-20260429-A01', category: 'Cell Assembly',     qty: '—',       machine: 'Assembly Line 1',  operator: 'L. Tan',  status: 'Released', started: '14:00', yield: 95.5 },
];

export const CATEGORIES = ['Cathode Electrode', 'Anode Electrode', 'Separator', 'Electrolyte', 'Cell Assembly'] as const;
export const CATEGORY_TONES: Record<string, string> = {
  'Cathode Electrode': '#22c55e',
  'Anode Electrode':   '#3b82f6',
  'Separator':         '#f59e0b',
  'Electrolyte':       '#a855f7',
  'Cell Assembly':     '#f97316',
};

export const MAIN_BATCHES: MainBatch[] = [
  {
    id: 'MIXC-20260430-A01', category: 'Cathode Electrode', qty: '50.0 kg',
    remaining: '12.5 kg', remainingPct: 25, supplier: 'Targray Industries', received: '2026-04-24',
    subBatches: [
      { id: 'MIXC-20260430-A01-01', parentId: 'MIXC-20260430-A01', category: 'Cathode Electrode', qty: '12.5 kg', machine: 'Coating Line A', operator: 'L. Tan',   status: 'Released',   started: '2026-04-30 06:00', yield: 95.2 },
      { id: 'MIXC-20260430-A01-02', parentId: 'MIXC-20260430-A01', category: 'Cathode Electrode', qty: '12.5 kg', machine: 'Coating Line B', operator: 'R. Mehta', status: 'Released',   started: '2026-04-30 07:30', yield: 94.8 },
      { id: 'MIXC-20260430-A01-03', parentId: 'MIXC-20260430-A01', category: 'Cathode Electrode', qty: '12.5 kg', machine: 'Coating Line A', operator: 'L. Tan',   status: 'InProgress', started: '2026-04-30 09:14', yield: null },
      { id: 'MIXC-20260430-A01-04', parentId: 'MIXC-20260430-A01', category: 'Cathode Electrode', qty: '12.5 kg', machine: 'Coating Line B', operator: 'K. Chen',  status: 'OnHold',     started: '—', yield: null },
    ],
  },
  {
    id: 'CALN-20260430-A01', category: 'Anode Electrode', qty: '40.0 kg',
    remaining: '20.0 kg', remainingPct: 50, supplier: 'BTR New Material', received: '2026-04-25',
    subBatches: [
      { id: 'CALN-20260430-A01-01', parentId: 'CALN-20260430-A01', category: 'Anode Electrode', qty: '10.0 kg', machine: 'Calendaring A', operator: 'K. Chen',  status: 'Released',   started: '2026-04-30 06:15', yield: 96.1 },
      { id: 'CALN-20260430-A01-02', parentId: 'CALN-20260430-A01', category: 'Anode Electrode', qty: '10.0 kg', machine: 'Calendaring B', operator: 'R. Mehta', status: 'InProgress', started: '2026-04-30 08:50', yield: null },
    ],
  },
  {
    id: 'SLIT-20260430-B02', category: 'Separator', qty: '25.0 kg',
    remaining: '16.8 kg', remainingPct: 67, supplier: 'Asahi Kasei', received: '2026-04-26',
    subBatches: [
      { id: 'SLIT-20260430-B02-01', parentId: 'SLIT-20260430-B02', category: 'Separator', qty: '8.2 kg', machine: 'Slitting Line 1', operator: 'J. Park', status: 'OnHold', started: '2026-04-30 07:30', yield: null },
    ],
  },
];

export const SUBBATCH_DETAIL = {
  id:          'MIXC-20260430-A01-03',
  parentId:    'MIXC-20260430-A01',
  category:    'Cathode Electrode',
  qty:         '12.5 kg',
  machine:     'Coating Line A',
  machineRef:  'CLA-001',
  operator:    'L. Tan',
  status:      'InProgress' as BatchStatus,
  started:     '2026-04-30 09:14 SGT',
  startedRel:  '2h 28m ago',
  notes:       'Standard coating run. Dry room humidity within spec at 0.8% RH.',
};

export const PROCESS_ROUTE = [
  { id: 'mixing',      label: 'Mixing',      status: 'completed' as const, qc: 'passed', ts: '06:00' },
  { id: 'coating',     label: 'Coating',     status: 'active'    as const, qc: null,     ts: '09:14' },
  { id: 'calendaring', label: 'Calendaring', status: 'pending'   as const, qc: null,     ts: null },
  { id: 'slitting',    label: 'Slitting',    status: 'pending'   as const, qc: null,     ts: null },
];

export const TIMELINE = [
  {
    id: 't1', type: 'process' as const, step: 'Mixing', operator: 'K. Chen', ts: '06:00 SGT',
    isLive: false,
    params: [
      { k: 'Mixing speed',  v: '2500 rpm' },
      { k: 'Duration',      v: '45 min' },
      { k: 'Temperature',   v: '25°C' },
      { k: 'Solid content', v: '68.2%' },
    ],
  },
  {
    id: 't2', type: 'qc' as const, step: 'Mixing QC', operator: 'K. Chen', ts: '06:52 SGT',
    isLive: false,
    params: [
      { k: 'Viscosity',     v: '4820 mPa·s' },
      { k: 'Particle size', v: 'D50 8.2 µm' },
      { k: 'Verdict',       v: 'Passed' },
    ],
  },
  {
    id: 't3', type: 'process' as const, step: 'Coating', operator: 'L. Tan', ts: '09:14 SGT',
    isLive: true,
    params: [
      { k: 'Web speed',   v: '8.5 m/min' },
      { k: 'Gap (front)', v: '180 µm' },
      { k: 'TC-1',        v: '82°C' },
      { k: 'TC-2',        v: '90°C' },
      { k: 'TC-3',        v: '95°C' },
      { k: 'TC-4',        v: '95°C' },
      { k: 'TC-5',        v: '88°C' },
      { k: 'TC-6',        v: '75°C' },
    ],
  },
];

export const GENEALOGY = {
  parents: [
    { kind: 'Cathode slurry', id: 'SLRY-20260429-001',   qty: '15.0 kg', supplier: 'Internal' },
    { kind: 'Substrate foil', id: 'FOIL-20260428-AL-02', qty: '200 m²',  supplier: 'Nippon Steel' },
  ],
  siblings: [
    { id: 'MIXC-20260430-A01-01', status: 'Released'   as BatchStatus },
    { id: 'MIXC-20260430-A01-02', status: 'Released'   as BatchStatus },
    { id: 'MIXC-20260430-A01-04', status: 'OnHold'     as BatchStatus },
  ],
};

// ── Lots ─────────────────────────────────────────────────────────────

// Lots use the same batch_status enum as sub-batches
export type LotStatus = BatchStatus;

export interface Unit {
  serial: string;
  subBatchId: string;
  createdAt: string;
}

export interface Lot {
  id: string;
  batteryType: string;
  storageLocation: string;
  unitCount: number;
  sourceSubBatches: string[];
  createdAt: string;
  status: LotStatus;
  units: Unit[];
}

// Kept for pages that imported the old name
export const LOT_STATUS_TONES = BATCH_STATUS_TONES;

export const LOTS: Lot[] = [
  {
    id: 'L-20260430-009', batteryType: 'Flint Cell Gen-2', storageLocation: 'WH-1', unitCount: 8,
    sourceSubBatches: ['MIXC-20260430-A01-03', 'CALN-20260430-A01-02', 'SLIT-20260430-B02-01', 'FILL-20260430-A01-01', 'ASSY-20260430-A01-01'],
    createdAt: '2026-04-30 14:22', status: 'Released',
    units: [
      { serial: 'U-20260430-0042', subBatchId: 'MIXC-20260430-A01-03', createdAt: '2026-04-30 13:10' },
      { serial: 'U-20260430-0043', subBatchId: 'CALN-20260430-A01-02', createdAt: '2026-04-30 13:11' },
      { serial: 'U-20260430-0044', subBatchId: 'SLIT-20260430-B02-01', createdAt: '2026-04-30 13:12' },
      { serial: 'U-20260430-0045', subBatchId: 'FILL-20260430-A01-01', createdAt: '2026-04-30 13:13' },
      { serial: 'U-20260430-0046', subBatchId: 'ASSY-20260430-A01-01', createdAt: '2026-04-30 13:14' },
      { serial: 'U-20260430-0047', subBatchId: 'MIXC-20260430-A01-03', createdAt: '2026-04-30 13:15' },
      { serial: 'U-20260430-0048', subBatchId: 'CALN-20260430-A01-02', createdAt: '2026-04-30 13:16' },
      { serial: 'U-20260430-0049', subBatchId: 'SLIT-20260430-B02-01', createdAt: '2026-04-30 13:17' },
    ],
  },
  {
    id: 'L-20260430-007', batteryType: 'Flint Cell Gen-2', storageLocation: 'WH-2', unitCount: 12,
    sourceSubBatches: ['CALN-20260430-A01-01', 'MIXC-20260430-A01-02', 'SLIT-20260429-C01-01', 'FILL-20260429-A02-01', 'ASSY-20260429-A01-02'],
    createdAt: '2026-04-30 11:05', status: 'Released',
    units: Array.from({ length: 12 }, (_, i) => ({
      serial: `U-20260430-${String(30 + i).padStart(4, '0')}`,
      subBatchId: ['CALN-20260430-A01-01', 'MIXC-20260430-A01-02', 'SLIT-20260429-C01-01', 'FILL-20260429-A02-01', 'ASSY-20260429-A01-02'][i % 5],
      createdAt: `2026-04-30 10:${String(20 + i).padStart(2, '0')}`,
    })),
  },
  {
    id: 'L-20260430-006', batteryType: 'Paper Battery Cell v1', storageLocation: 'WH-1', unitCount: 11,
    sourceSubBatches: ['MIXC-20260429-A01-05', 'CALN-20260429-C01-01', 'SLIT-20260429-D01-01', 'FILL-20260429-B01-01', 'ASSY-20260429-B01-01'],
    createdAt: '2026-04-30 09:44', status: 'InProgress',
    units: Array.from({ length: 11 }, (_, i) => ({
      serial: `U-20260430-${String(21 + i).padStart(4, '0')}`,
      subBatchId: ['MIXC-20260429-A01-05', 'CALN-20260429-C01-01', 'SLIT-20260429-D01-01', 'FILL-20260429-B01-01', 'ASSY-20260429-B01-01'][i % 5],
      createdAt: `2026-04-30 09:${String(10 + i).padStart(2, '0')}`,
    })),
  },
  {
    id: 'L-20260429-012', batteryType: 'Paper Battery Cell v1', storageLocation: 'Shipped', unitCount: 15,
    sourceSubBatches: ['SLIT-20260429-C01-02', 'SLIT-20260429-A01-01', 'MIXC-20260429-A01-04', 'CALN-20260429-B01-01', 'FILL-20260429-C01-01'],
    createdAt: '2026-04-29 18:30', status: 'Released',
    units: Array.from({ length: 15 }, (_, i) => ({
      serial: `U-20260429-${String(50 + i).padStart(4, '0')}`,
      subBatchId: ['SLIT-20260429-C01-02', 'SLIT-20260429-A01-01', 'MIXC-20260429-A01-04', 'CALN-20260429-B01-01', 'FILL-20260429-C01-01'][i % 5],
      createdAt: `2026-04-29 18:${String(i).padStart(2, '0')}`,
    })),
  },
  {
    id: 'L-20260429-010', batteryType: 'Flint Cell Gen-2', storageLocation: 'WH-3', unitCount: 9,
    sourceSubBatches: ['MIXC-20260429-A01-02', 'CALN-20260429-B01-02', 'SLIT-20260429-A01-02', 'FILL-20260429-A01-02', 'ASSY-20260429-C01-01'],
    createdAt: '2026-04-29 23:05', status: 'Quarantine',
    units: Array.from({ length: 9 }, (_, i) => ({
      serial: `U-20260429-${String(10 + i).padStart(4, '0')}`,
      subBatchId: ['MIXC-20260429-A01-02', 'CALN-20260429-B01-02', 'SLIT-20260429-A01-02', 'FILL-20260429-A01-02', 'ASSY-20260429-C01-01'][i % 5],
      createdAt: `2026-04-29 22:${String(50 + i).padStart(2, '0')}`,
    })),
  },
];
