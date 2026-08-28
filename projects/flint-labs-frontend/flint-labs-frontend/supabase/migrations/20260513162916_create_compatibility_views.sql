
-- View: sub_batches (batches where parent exists)
CREATE VIEW sub_batches AS
SELECT
  id,
  batch_number AS "id_display",
  parent_batch_id AS parent_id,
  material_id,
  status,
  current_quantity,
  original_quantity,
  unit,
  current_location,
  expiry_date,
  created_at,
  updated_at
FROM batches
WHERE parent_batch_id IS NOT NULL;

-- View: main_batches (batches where parent is null)
CREATE VIEW main_batches AS
SELECT
  id,
  batch_number AS "id_display",
  material_id,
  status,
  current_quantity,
  original_quantity,
  unit,
  current_location,
  expiry_date,
  created_at,
  updated_at
FROM batches
WHERE parent_batch_id IS NULL;

-- View: machines (alias for equipment)
CREATE VIEW machines AS
SELECT
  id,
  equipment_code AS code,
  name,
  process_id,
  supplier_info AS supplier,
  is_active,
  created_at
FROM equipment;

-- View: maintenance (alias for equipment_maintenance)
CREATE VIEW maintenance AS
SELECT
  id,
  equipment_id AS machine_id,
  maintenance_date AS date,
  next_due_date,
  performed_by,
  reviewed_by,
  approved_by,
  notes,
  created_at
FROM equipment_maintenance;

-- View: process_steps (alias for processes)
CREATE VIEW process_steps AS
SELECT
  id,
  code AS process_code,
  name AS label,
  requires_calibration,
  sequence_hint AS sequence_order,
  created_at
FROM processes;

-- View: qc_check_items (alias for qc_check_definitions)
CREATE VIEW qc_check_items AS
SELECT
  id,
  process_id,
  qc_item_name AS label,
  description,
  method,
  timing,
  acceptance_criteria_text AS acceptance_criteria,
  acceptance_criteria_min,
  acceptance_criteria_max,
  fail_action,
  created_at
FROM qc_check_definitions;
