
-- PROCESS RUNS (common trunk for all machines)
CREATE TABLE process_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_number TEXT,
  process_id UUID NOT NULL REFERENCES processes(id),
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  operator_id UUID NOT NULL REFERENCES users(id),
  recipe_id UUID REFERENCES recipes(id),
  recipe_unchanged BOOLEAN DEFAULT true,
  output_batch_id UUID REFERENCES batches(id),
  start_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_date DATE,
  end_time TIME,
  status process_run_status NOT NULL DEFAULT 'InProgress',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- PROCESS RUN INPUTS (junction: which batches were consumed)
CREATE TABLE process_run_inputs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  process_run_id UUID NOT NULL REFERENCES process_runs(id) ON DELETE CASCADE,
  input_batch_id UUID NOT NULL REFERENCES batches(id),
  quantity_consumed DECIMAL(12,4),
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PROCESS RUN PARAMETERS (EAV: actual values used during the run)
CREATE TABLE process_run_parameters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  process_run_id UUID NOT NULL REFERENCES process_runs(id) ON DELETE CASCADE,
  parameter_key TEXT NOT NULL,
  parameter_value DECIMAL(12,4),
  unit TEXT,
  is_modified_from_recipe BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(process_run_id, parameter_key)
);
