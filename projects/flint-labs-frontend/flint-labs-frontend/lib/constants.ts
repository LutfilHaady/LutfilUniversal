import type { BatchStatus, ProcessRunStatus, StatusTone, RecipeProcess, ParamField } from '@/lib/types';

// ── Status display constants ──────────────────────────────────────────

// Valid status transitions (enforced in UI before calling transition_batch_status RPC)
export const BATCH_STATUS_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  InProgress: ['Released', 'OnHold', 'Quarantine', 'Scrapped'],
  OnHold:     ['Released', 'Quarantine', 'Scrapped'],
  Quarantine: ['Released', 'Scrapped'],
  Released:   [],
  Scrapped:   [],
};

export const TERMINAL_STATUSES: BatchStatus[] = ['Released', 'Scrapped'];

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

// Lots share the same status enum and tones as batches
export const LOT_STATUS_TONES = BATCH_STATUS_TONES;

// ── Material category constants ───────────────────────────────────────
// Five correct material types per SRS §1 and §11.3

export const CATEGORIES = [
  'Cathode Electrode',
  'Anode Electrode',
  'Separator',
  'Electrolyte',
  'Casing',
] as const;

export const CATEGORY_TONES: Record<string, string> = {
  'Cathode Electrode': '#22c55e',
  'Anode Electrode':   '#3b82f6',
  'Separator':         '#f59e0b',
  'Electrolyte':       '#a855f7',
  'Casing':            '#888888',
};

// ── Recipe config constants ───────────────────────────────────────────

export const RECIPE_PROCESSES: RecipeProcess[] = [
  'Mixing', 'Coating & Oven Drying', 'Calendaring',
  'Die Cutting', 'Cutting', 'Slitting', 'Assembly',
];

// Maps a (RecipeProcess, material) selection to the exact processes.name in the DB.
// Used to resolve process_id when creating a new recipe, so the Material dropdown
// selects the correct DB variant (e.g. Mixing → "Mixing (Cathode)" vs "(Electrolyte)").
// Key format: `${process}|${material}` (Assembly uses an empty material).
export const PROCESS_MATERIAL_TO_DB_NAME: Record<string, string> = {
  'Mixing|Cathode Electrode':               'Mixing (Cathode)',
  'Mixing|Electrolyte':                     'Mixing (Electrolyte)',
  'Coating & Oven Drying|Cathode Electrode':'Coating & Oven Drying',
  'Calendaring|Cathode Electrode':          'Calendaring',
  'Die Cutting|Cathode Electrode':          'Die Cutting (Cathode)',
  'Die Cutting|Anode Electrode':            'Die Cutting (Anode)',
  'Cutting|Separator':                      'Cutting (Separator)',
  'Slitting|Separator':                     'Slitting (Separator)',
  'Slitting|Casing':                        'Slitting (Casing)',
  'Assembly|':                              'Assembly',
};

export const PROCESS_MATERIALS: Record<RecipeProcess, string[]> = {
  'Mixing':               ['Cathode Electrode', 'Electrolyte'],
  'Coating & Oven Drying':['Cathode Electrode'],
  'Calendaring':          ['Cathode Electrode'],
  'Die Cutting':          ['Cathode Electrode', 'Anode Electrode'],
  'Cutting':              ['Separator'],
  'Slitting':             ['Separator', 'Casing'],
  'Assembly':             [],
};

export const PROCESS_PARAM_FIELDS: Record<RecipeProcess, ParamField[]> = {
  'Mixing': [
    {
      kind: 'rows',
      key: 'mixing_steps',
      label: 'Mixing Steps',
      addLabel: 'Add Material Step',
      columns: [
        { key: 'material',              label: 'Material',          type: 'text' },
        { key: 'mixing_time_hr',        label: 'Mixing Time',       unit: 'hr'    },
        { key: 'temperature_c',         label: 'Temperature',       unit: '°C'    },
        { key: 'internal_pressure_bar', label: 'Internal Pressure', unit: 'bar'   },
        { key: 'dispersion_rpm',        label: 'Dispersion RPM',    unit: 'rpm'   },
        { key: 'propeller_rpm',         label: 'Propeller RPM',     unit: 'rpm'   },
        { key: 'target_viscosity_mpas', label: 'Target Viscosity',  unit: 'mPa·s' },
      ],
    },
  ],
  'Coating & Oven Drying': [
    { kind: 'scalar', key: 'substrate_feeding_speed_mm_per_min', label: 'Substrate Feeding Speed', unit: 'mm/min' },
    { kind: 'scalar', key: 'transfer_gap_um',  label: 'Transfer Gap',   unit: 'µm' },
    { kind: 'scalar', key: 'coating_length_m', label: 'Coating Length', unit: 'm'  },
    { kind: 'scalar', key: 'wet_thickness_mm', label: 'Wet Thickness',  unit: 'mm' },
    { kind: 'array',  key: 'upper_oven_temps_c', label: 'Upper Oven RC', unit: '°C', length: 6,
      itemLabels: ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6'] },
    { kind: 'array',  key: 'lower_oven_temps_c', label: 'Lower Oven RC', unit: '°C', length: 6,
      itemLabels: ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6'] },
    { kind: 'array',  key: 'fan_speeds_hz', label: 'Fan Speeds', unit: 'Hz', length: 6,
      itemLabels: ['Fan 1', 'Fan 2', 'Fan 3', 'Fan 4', 'Fan 5', 'Fan 6'] },
  ],
  'Calendaring': [
    { kind: 'scalar', key: 'pressure_mpa',        label: 'Pressure',          unit: 'MPa'   },
    { kind: 'scalar', key: 'calendared_length_m', label: 'Calendared Length', unit: 'm'     },
    { kind: 'scalar', key: 'feed_rate_m_per_min', label: 'Feed Rate',         unit: 'm/min' },
  ],
  'Die Cutting': [
    { kind: 'scalar', key: 'cutting_piston_travel_depth_mm', label: 'Cutting Piston Travel Depth', unit: 'mm'   },
    { kind: 'scalar', key: 'distance_between_cuts_mm',       label: 'Distance Between Cuts',       unit: 'mm'   },
    { kind: 'scalar', key: 'machine_feed_rate_mm_per_s',     label: 'Machine Feed Rate',           unit: 'mm/s' },
    { kind: 'scalar', key: 'target_pcs_cut',                 label: 'Target Pieces Cut',           unit: 'pcs'  },
  ],
  'Cutting': [
    { kind: 'scalar', key: 'cutting_distance_mm',       label: 'Cutting Distance',  unit: 'mm'   },
    { kind: 'scalar', key: 'travel_speed_mm_per_s',     label: 'Travel Speed',      unit: 'mm/s' },
    { kind: 'scalar', key: 'roll_tension_controller_a', label: 'Roll Tension',      unit: 'A'    },
    { kind: 'scalar', key: 'target_pcs_cut',            label: 'Target Pieces Cut', unit: 'pcs'  },
  ],
  'Slitting': [
    { kind: 'scalar', key: 'slit_length_m',              label: 'Slit Length',              unit: 'm' },
    { kind: 'scalar', key: 'feed_rate_pct',              label: 'Feed Rate',                unit: '%' },
    { kind: 'scalar', key: 'disc_blade_distance_mm',     label: 'Disc Blade Distance',      unit: 'mm' },
    { kind: 'scalar', key: 'unwinding_tension_a',        label: 'Unwinding Tension',        unit: 'A' },
    { kind: 'scalar', key: 'upper_rewinding_tension_a',  label: 'Upper Rewinding Tension',  unit: 'A' },
    { kind: 'scalar', key: 'lower_rewinding_tension_a',  label: 'Lower Rewinding Tension',  unit: 'A' },
    { kind: 'scalar', key: 'sub_batches_per_output_min', label: 'Sub-batches/Output (min)', unit: '' },
    { kind: 'scalar', key: 'sub_batches_per_output_max', label: 'Sub-batches/Output (max)', unit: '' },
  ],
  'Assembly': [
    { kind: 'scalar', key: 'target_cells_per_run', label: 'Target Cells Per Run', unit: 'cells' },
  ],
};
