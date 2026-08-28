
-- ROLES
CREATE TABLE roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PROCESSES
CREATE TABLE processes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  requires_calibration BOOLEAN NOT NULL DEFAULT false,
  sequence_hint INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
