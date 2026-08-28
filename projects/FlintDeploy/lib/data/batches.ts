import type { BatchStatus, SubBatch, MainBatch } from '@/lib/types';

// ── Mock data — delete once each component is wired to Supabase ───────

// Replaced by useBatches / useDashboard hooks
export const SUB_BATCHES: SubBatch[] = [];
export const MAIN_BATCHES: MainBatch[] = [];

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
