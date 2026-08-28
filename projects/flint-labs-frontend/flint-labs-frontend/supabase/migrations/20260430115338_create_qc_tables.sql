
-- QC CHECK DEFINITIONS (the rulebook)
CREATE TABLE qc_check_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES processes(id),
  qc_item_name TEXT NOT NULL,
  description TEXT,
  method qc_method NOT NULL,
  timing qc_timing NOT NULL,
  acceptance_criteria_text TEXT,
  acceptance_criteria_min DECIMAL(12,4),
  acceptance_criteria_max DECIMAL(12,4),
  fail_action TEXT DEFAULT 'Scrap',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(process_id, qc_item_name)
);

-- QC CHECK RESULTS (one row per check per run)
CREATE TABLE qc_check_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  process_run_id UUID NOT NULL REFERENCES process_runs(id) ON DELETE CASCADE,
  qc_check_definition_id UUID NOT NULL REFERENCES qc_check_definitions(id),
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ DEFAULT now(),
  timing qc_timing NOT NULL,
  result_value_numeric DECIMAL(12,4),
  result_value_boolean BOOLEAN,
  result_text TEXT,
  passed BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- QC OVERRIDES (engineer override audit trail)
CREATE TABLE qc_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  qc_check_result_id UUID NOT NULL REFERENCES qc_check_results(id) ON DELETE CASCADE UNIQUE,
  overridden_by UUID NOT NULL REFERENCES users(id),
  override_reason TEXT NOT NULL,
  overridden_at TIMESTAMPTZ DEFAULT now()
);
