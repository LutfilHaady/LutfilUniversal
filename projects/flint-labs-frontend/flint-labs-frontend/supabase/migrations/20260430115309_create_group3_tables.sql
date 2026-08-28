
-- ROLE PERMISSIONS
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);

-- EQUIPMENT MAINTENANCE
CREATE TABLE equipment_maintenance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL,
  next_due_date DATE,
  performed_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RECIPE PARAMETERS (EAV)
CREATE TABLE recipe_parameters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  parameter_key TEXT NOT NULL,
  parameter_value DECIMAL(12,4),
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id, parameter_key)
);

-- BATCHES (core traceability)
CREATE TABLE batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number TEXT NOT NULL UNIQUE,
  parent_batch_id UUID REFERENCES batches(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  status batch_status NOT NULL DEFAULT 'InProgress',
  current_quantity DECIMAL(12,4),
  original_quantity DECIMAL(12,4),
  unit TEXT,
  current_location TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
