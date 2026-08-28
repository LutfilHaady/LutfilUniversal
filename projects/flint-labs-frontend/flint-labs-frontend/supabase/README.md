# Supabase — schema & seed

This folder contains everything needed to recreate the Flint Batch Traceability
database from scratch on **your own** Supabase project. It was extracted from the
original team's project (`pewrwrqituidyxhfsner`) on 2026-06-03.

```
supabase/
  migrations/   22 ordered migration files (tables, views, enums, RPCs, triggers)
  seed.sql      reference/lookup data (roles, processes, materials, QC defs, perms)
```

## Recreate the database on a fresh project

You need the [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
# 1. Create a new project in the Supabase dashboard, then grab its project ref.

# 2. Initialise the CLI in this repo (creates config.toml; leaves migrations alone)
supabase init          # skip if config.toml already exists

# 3. Link to your new project (you'll be prompted for the DB password)
supabase link --project-ref <your-project-ref>

# 4. Apply all migrations in order
supabase db push

# 5. Load the reference seed data
psql "<your-connection-string>" -f supabase/seed.sql
#    (or run the contents of seed.sql in the dashboard SQL editor)
```

After this you'll have the full schema, all 6 RPCs, the auth trigger, and the
lookup tables populated. The transactional tables (batches, process_runs, QC
results, lots, units, alerts, mixing_steps) start empty — that's expected.

## What's intentionally NOT here

- **`equipment` rows** — blocked on the real machine list from Flint. The app's
  process-logging and machine pages need at least one equipment row per process
  to be fully usable; add them once you have the list.
- **Auth/test users** — creating working login accounts requires a 3-step insert
  into `auth.users` with specific GoTrue requirements. The exact SQL (and the
  role UUIDs, which match `seed.sql`) is in
  [`../docs/FLINT_REFERENCE_21052026.md`](../docs/FLINT_REFERENCE_21052026.md) §13–§14.
- **RLS policies** — Row Level Security is intentionally disabled during
  development. Enabling it with role-based policies is a pre-go-live task
  (reference §10, task 3A).

## Notes

- The actual enum values in the DB are PascalCase: `qc_timing` = `Startup` /
  `EndOfRun`, `qc_method` = `VisualManual` / `ToolEquipment`. (Some older prose in
  the reference doc still shows kebab-case — the migrations here are authoritative.)
- Migration `20260521093855` immediately re-creates `transition_batch_status` to
  fix column names (`old_status`/`new_status` → `from_status`/`to_status`). Both
  files are kept so the history replays exactly as it ran on the source project.
- These files reproduce the migration **history**, not a squashed snapshot. Once
  you're past go-live you may want to squash them into a single baseline migration.
