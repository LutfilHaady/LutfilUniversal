---
name: project-alerts-mvp
description: Alerts feature shipped as an app-side-scan MVP; generic rule-builder deferred
metadata: 
  node_type: memory
  type: project
  originSessionId: 1da352ba-2d2f-429c-b300-0a6fbb0403fa
---

The alerts feature was revamped 2026-06-04 into a working MVP (branch `feat/customisable-alerts-mvp`): `alert_rules` catalog table, app-side `scanAlerts()` generation (no DB triggers), one `useAlerts` hook across all 4 surfaces, Engineer/Admin dismiss, Admin rule editor in `/admin` → Settings. Mock `lib/alerts-data.ts` was deleted.

**KIV'd for a future iteration** (the user originally wanted these): generic any-entity/any-field rule builder, auto-resolve when a condition clears, DB triggers / pg_cron generation, low-stock rule (needs a material min-threshold field), per-rule custom message templates.

Design + plan: `docs/superpowers/specs/2026-06-04-customisable-alerts-mvp-design.md`, `docs/superpowers/plans/2026-06-04-customisable-alerts-mvp.md`. Aligns with the user's [[feedback-mvp-first]] working style.
