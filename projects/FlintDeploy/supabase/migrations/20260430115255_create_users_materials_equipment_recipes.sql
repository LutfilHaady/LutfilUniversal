
-- USERS (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  full_name TEXT NOT NULL DEFAULT '',
  staff_code TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- MATERIALS
CREATE TABLE materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  shelf_life_days INT,
  min_storage_threshold DECIMAL(10,2),
  first_process_id UUID REFERENCES processes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- EQUIPMENT
CREATE TABLE equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES processes(id),
  equipment_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  supplier_info TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RECIPES
CREATE TABLE recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES processes(id),
  name TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES users(id),
  parent_recipe_id UUID REFERENCES recipes(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, version)
);
