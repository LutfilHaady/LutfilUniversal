// ── Dashboard mock data ──────────────────────────────────────────────
// TODO: replace YIELD_TREND with useYieldTrend hook (query process_runs / batches)
// TODO: replace ALERTS with a live query against the `alerts` table

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
