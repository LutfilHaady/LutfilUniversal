-- Maintenance checklist feature (client spec: per-machine Y/N + remarks checklist)
--
-- NOTE: these two columns were already applied directly to the live Supabase
-- project (pewrwrqituidyxhfsner) ahead of this file. This migration backfills
-- the repo so a fresh database stands up identically. It is idempotent
-- (IF NOT EXISTS) and safe to re-run against the live DB.

-- Per-machine checklist task template: a JSONB array of task-name strings,
-- e.g. ["Rail Lubrication", "Distance Calibration", "Joint Lubrication"].
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS checklist_template jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Checklist results captured with each maintenance log entry: a JSONB array of
-- { "task": text, "completed": bool, "remarks": text } objects.
ALTER TABLE public.equipment_maintenance
  ADD COLUMN IF NOT EXISTS checklist_results jsonb NOT NULL DEFAULT '[]'::jsonb;
