---
name: Supabase backend is live
description: Supabase schema is complete and live; integration into frontend not yet started
type: project
originSessionId: 347f6547-145b-4288-8ffd-115dc99188e6
---
The Supabase backend for Flint is live at `https://pewrwrqituidyxhfsner.supabase.co` (Tokyo, PostgreSQL 17).

**Why:** Backend team completed the schema (22 tables, 6 views, 4 enums). The full handoff is in `docs/flint_backend_handoff.md` and merged into `docs/FLINT_REFERENCE.md`.

**How to apply:** All new frontend work should be written against the real Supabase schema, not mock data. Use `docs/FLINT_REFERENCE.md` as the reference before starting any feature. The Supabase anon key lives in Supabase Dashboard → Settings → API; project URL is `https://pewrwrqituidyxhfsner.supabase.co`.

Current blockers: equipment table is empty (needs machine list from Flint); login page not built; RLS not yet enabled.
