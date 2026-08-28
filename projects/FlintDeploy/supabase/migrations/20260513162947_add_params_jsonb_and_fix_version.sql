
-- Add JSONB params column to recipes (convenience copy for frontend reads)
ALTER TABLE recipes ADD COLUMN params JSONB DEFAULT '{}';

-- Add JSONB params column to process_runs (convenience copy for frontend reads)
ALTER TABLE process_runs ADD COLUMN params JSONB DEFAULT '{}';

-- Change recipes.version from INT to TEXT for semver support (table is empty, clean swap)
ALTER TABLE recipes DROP CONSTRAINT recipes_name_version_key;
ALTER TABLE recipes ALTER COLUMN version TYPE TEXT USING version::TEXT;
ALTER TABLE recipes ALTER COLUMN version SET DEFAULT '1.0';
ALTER TABLE recipes ADD CONSTRAINT recipes_name_version_key UNIQUE (name, version);

-- Add human-readable recipe number for frontend display
ALTER TABLE recipes ADD COLUMN recipe_number TEXT UNIQUE;

-- Add notes column to recipes if not present (frontend expects it)
-- Already checking: recipes has no notes column currently
ALTER TABLE recipes ADD COLUMN notes TEXT;
