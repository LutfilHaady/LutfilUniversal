
-- BATCH RAW MATERIAL INTAKE (1:1 extension for raw material batches)
CREATE TABLE batch_raw_material_intake (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE UNIQUE,
  supplier_name TEXT,
  supplier_batch_no TEXT,
  po_number TEXT,
  date_received TIMESTAMPTZ,
  sampled_by UUID REFERENCES users(id),
  sampled_at TIMESTAMPTZ,
  sample_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- BATCH STATUS CHANGES (audit log)
CREATE TABLE batch_status_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  from_status batch_status NOT NULL,
  to_status batch_status NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT
);
