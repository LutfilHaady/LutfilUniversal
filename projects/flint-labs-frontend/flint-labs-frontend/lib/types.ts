// ── Status types ──────────────────────────────────────────────────────

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

// Legacy alias — kept for components still using it
export type SubBatchStatus = BatchStatus;

export interface StatusTone {
  bg: string;
  border: string;
  fg: string;
  dot: string;
  label: string;
}

export type LotStatus = BatchStatus;

// ── Batch types ───────────────────────────────────────────────────────

export interface SubBatch {
  id: string
  batch_number: string
  parent_batch_id: string | null
  material_id: string
  status: BatchStatus
  current_quantity: number | null
  original_quantity: number | null
  unit: string | null
  current_location: string | null
  created_at: string
  updated_at: string
  // Optional join fields
  material?: { name: string; code: string } | null
  // Legacy/mock UI fields (optional) — kept to ease migration to Supabase-backed shapes
  category?: string
  qty?: string
  machine?: string
  machineRef?: string
  operator?: string
  started?: string
  startedRel?: string
  notes?: string
}

export interface MainBatch {
  id: string
  batch_number: string
  parent_batch_id: string | null
  material_id: string
  status: BatchStatus
  current_quantity: number | null
  original_quantity: number | null
  unit: string | null
  current_location: string | null
  created_at: string
  updated_at: string
  // From joins
  material: { name: string; code: string } | null
  intake: { supplier_name: string | null; date_received: string | null } | null
  sub_batches: SubBatch[]
}

// ── Mixing types ──────────────────────────────────────────────────────

export type MixingStepType   = 'add_material' | 'mix_round';
export type MixingStepStatus = 'in_progress' | 'completed' | 'voided';

export interface AddMaterialParams {
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: 'kg' | 'L' | 'g' | 'mL';
}

export interface MixRoundParams {
  durationMinutes: number;
  temperatureCelsius: number;
  internalPressureBar: number;
  dispersionRpm: number;
  propellerRpm: number;
}

interface MixingStepBase {
  id?: string;
  stepNumber: number;
  label: string;
  displayRef: string;
  status: MixingStepStatus;
  operator: string;
  timestamp: string;
}

export interface AddMaterialStep extends MixingStepBase {
  type: 'add_material';
  params: AddMaterialParams;
}

export interface MixRoundStep extends MixingStepBase {
  type: 'mix_round';
  params: MixRoundParams;
}

export type MixingStep = AddMaterialStep | MixRoundStep;

// ── Recipe types ──────────────────────────────────────────────────────

export type RecipeProcess =
  | 'Mixing'
  | 'Coating & Oven Drying'
  | 'Calendaring'
  | 'Die Cutting'
  | 'Cutting'
  | 'Slitting'
  | 'Assembly';

// One column inside a 'rows' field (e.g. a single mixing-step attribute).
export interface ParamColumn {
  key: string;                 // JSONB key inside each row object, e.g. 'mixing_time_hr'
  label: string;
  unit?: string;
  type?: 'number' | 'text';    // default 'number'; the material column is 'text'
}

// A recipe parameter field. `key` always matches the key in recipes.params JSONB.
//  - scalar: a single number,            params[key] = number
//  - array:  a fixed-length number list, params[key] = number[]
//  - rows:   a variable-length list of   params[key] = Array<Record<colKey, value>>
//            column-keyed objects (Mixing's per-material steps)
export type ParamField =
  | { kind: 'scalar'; key: string; label: string; unit: string }
  | { kind: 'array';  key: string; label: string; unit: string; length: number; itemLabels: string[] }
  | { kind: 'rows';   key: string; label: string; addLabel: string; columns: ParamColumn[] };

export interface Recipe {
  id: string
  recipe_number: string | null
  name: string
  process_id: string
  version: string
  created_by: string | null
  is_active: boolean
  created_at: string
  params: Record<string, unknown>
  notes: string | null
  parent_recipe_id: string | null
  // From joins
  process: { name: string; code: string } | null
  creator: { full_name: string } | null
}

// ── Lot types ─────────────────────────────────────────────────────────

export interface Unit {
  serial: string
  lot_id: string
  sub_batch_id: string
  created_at: string
}

export interface Lot {
  id: string
  lot_number: string
  category: string
  unit_count: number
  status: LotStatus
  battery_type: string | null
  storage_location: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  // From joins
  lot_sub_batches: { sub_batch_id: string }[]
  units?: Unit[]
}

// ── Process Timeline types (Tasks 2-4) ─────────────────────────────────

/**
 * Unified timeline entry for process runs and QC checks.
 * Used to display chronological process history with dedup.
 */
export interface ProcessRunTimeline {
  id: string
  sub_batch_id: string
  process_id?: string
  roll_id: string | null  // For dedup: group by roll_id to prevent duplicates
  type: 'process' | 'qc'  // Discriminator: process_runs vs qc_check_results
  step_name: string
  operator_id?: string | null
  operator_name: string | null
  status: ProcessRunStatus
  started_at: string  // ISO timestamp
  completed_at: string | null
  duration_minutes: number | null
  params: Array<{ key: string; value: string }>
  qc_result?: {  // Only if type === 'qc'
    passed: boolean
    notes: string | null
  }
}

/**
 * Batch history item for shallow + deep history expansion.
 */
export interface BatchHistoryItem {
  id: string
  batch_number: string
  parent_batch_id: string | null
  material_id: string
  material_name: string
  status: BatchStatus
  current_quantity: number | null
  unit: string | null
  created_at: string
  process_count: number  // Number of process runs
  qc_count: number  // Number of QC checks
}

/**
 * KPI values for dashboard display.
 */
export interface DashboardKPIs {
  totalActiveBatches: number
  subBatchesInProgress: number
  subBatchesOnHold: number
  qcPassRateSevenDay: number  // 0-100 percentage
  activeEquipmentCount: number
}
