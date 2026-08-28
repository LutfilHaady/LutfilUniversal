# Flint Labs — Production Line Batch Traceability System

> Resume project brief for **Lutfil Haady** — technical lead and primary contributor.

---

## Project Summary

**Flint Labs** is a full-stack production-line batch traceability system built for a real battery manufacturing client in Singapore. The app tracks every stage of lithium battery production — from raw material intake through mixing, coating, calendaring, die cutting, slitting, and final cell assembly — providing end-to-end QR-based traceability, quality control enforcement, genealogy tracking, and regulatory compliance reporting.

The system is **live in production** with a real client actively using it for daily manufacturing operations.

**Timeline:** May 2026 – June 2026 (7-week sprint cycle)
**Team:** 4 developers — Lutfil (tech lead, 143 commits), Subra (33 commits), Jonny (25 commits), Ethan (22 commits)
**My contribution:** 64% of all commits, 43,000+ lines of code, authored the entire architecture and most core features

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | **Next.js 16** (App Router), **React 19**, **TypeScript** |
| Styling | **Tailwind CSS v4** |
| Backend / DB | **Supabase** (PostgreSQL 17, Row-Level Security, RPCs, Auth) |
| Testing | **Playwright** (128+ E2E tests, all mocked — zero live DB writes) |
| Deployment | **Vercel** (auto-deploy on push, preview URLs per branch) |
| Data Fetching | **SWR** (stale-while-revalidate hooks) |
| QR Scanning | `@yudiel/react-qr-scanner` + local WASM (zxing) |
| Exports | **SheetJS** (XLSX), **PapaParse** (CSV) |

---

## Architecture Highlights

- **23 PostgreSQL tables** with 6 compatibility views, 4 custom enums, 28 indexes
- **7 database RPCs** for atomic operations (batch status transitions, mixing step logging, genealogy tracing, lot generation)
- **Row-Level Security (RLS)** across all 24 tables with 76 policies and a `get_my_role()` SECURITY DEFINER helper — role-based data isolation at the database level
- **3-tier RBAC** (Operator / Engineer / Admin) enforced at routing, page, and database layers
- **Branching strategy:** `feature/* -> dev (staging) -> main (production)` — every push to `main` auto-deploys to the client's production environment

---

## What I Built (Lutfil's Contributions)

### Core Architecture & Infrastructure

- **Designed and implemented the entire frontend architecture** — Next.js App Router shell, authentication context, middleware RBAC, SWR data-fetching layer, Supabase client setup
- **Supabase schema export** — 22 migration files covering all tables, RPCs, views, enums, indexes, and auth triggers, making the repo self-contained for standing up a fresh database
- **Row-Level Security migration** — authored all 76 RLS policies across 7 permission groups, `get_my_role()` helper function, and converted write RPCs to SECURITY DEFINER
- **Auth system** — Supabase login, session management, `auth-context.tsx` with LockManager deadlock fix (cold-load hang in production), role-resolution, middleware route guards
- **Production deployment setup** — Vercel deploy prep, equipment seed data, client-safety guardrails, `dev` integration branch workflow

### Feature Development (authored and shipped)

| Feature | What I Built |
|---------|-------------|
| **Batch Management** | Full batch lifecycle — registration with lab QC gate, main batch detail page (hero layout, info cards, status history), create sub-batch drawer with split integrity (parent quantity deduction, audit trail, process run creation) |
| **Mixing Operator Workspace** | Multi-step mixing log (Add Material + Mix Round), live RPC wiring (`log_mixing_step`, `update_mixing_step_status`), ratio calculator that back-solves material quantities from recipe ratios, ratio carry-over that pre-fills the next step's material/quantity |
| **Process Logging** | Rewrote from wizard to vertical scrolling form — all sections visible, dimmed until prerequisites met; equipment/recipe selection; calibration gate for machines requiring startup QC; `AwaitingQC` run closure on submit |
| **Mixing Sub-Batch QC** | Each "Add Material" step creates a child batch (`{parentBatchNumber}-{materialCode}`) with an inline QC gate (`MixingQCGate`) that blocks the next step until QC is completed |
| **QC System** | QC logging wizard with per-item checks, pass/fail path (pass creates output batch, fail puts input OnHold), QC override page for Engineers/Admins |
| **Customisable Alerts** | Full MVP — `alert_rules` catalog, app-side `scanAlerts()` generation engine, auto-resolve on condition clear, `useAlerts` SWR hook feeding 4 UI surfaces (page, dashboard panel, banner, header bell), Admin rule editor |
| **Genealogy & Recall** | Wired `trace_batch_genealogy` RPC to sub-batch detail panel, rendering ancestor/self/descendant trees with live data |
| **Global Search** | `Cmd+K` command palette with debounced live `ilike` search across batches/lots/recipes/equipment, keyboard navigation, route resolution |
| **Reports & Export** | Batch Summary, QC Analysis, Defect Trends, Compliance tab — all live Supabase queries with date-range filtering; CSV (PapaParse) and XLSX (SheetJS) export |
| **Equipment & Maintenance** | Add/edit/deactivate machines, per-machine maintenance checklist (Admin-defined template with Y/N + remarks), active toggle with double-click guard and FK-in-use error handling |
| **Recipes** | Full CRUD with versioning (`parent_recipe_id`), kind-aware parameter inputs (scalar/array/rows), active toggle, per-material `amount_kg` for mixing ratio calculations |
| **Admin** | User management (add/edit/delete/toggle via server actions), password reset modal, audit log with 30-day date-range filter, alert rules configuration |
| **QR Camera Scanning** | Wired `@yudiel/react-qr-scanner` with local WASM, diagnostic error messages per `IScannerError.kind`, equipment-code deep-linking, manual-entry fallback |
| **Dashboard** | KPI cards (active batches, first-pass yield, top defect, active alerts), yield trend chart, Operator 7-day history filter |
| **Lot Management** | `generate_lot` RPC integration, multi-select sub-batch picker, serial number preview |
| **Client Feedback Fixes** | Admin password reset, maintenance form field merge, back buttons on detail pages, UUID-leak cleanup (8 places showing raw DB UUIDs replaced with human-facing codes) |

### Data Layer & Hooks

- Converted all state-based data hooks to **SWR** (`useBatches`, `useDashboard`, `useLots`, `useRecipes`, `useMachines`, `useAlerts`, `useProcessRoute`, etc.)
- Extracted reusable modules: `lib/mixing/ratio-plan.ts` (ratio math), `lib/global-search.ts` (search + exact-match resolution), `lib/alerts/scan.ts` (alert generation engine)
- Split monolithic `lib/data.ts` into domain files to eliminate merge conflicts across the team

### Testing

- **29 test files** authored, covering 128+ passing E2E scenarios
- All tests mock Supabase REST calls via `page.route()` — **zero writes to the live database**
- Test patterns: page rendering, validation states, happy-path flows, error handling, request body assertions
- Rewrote legacy live-DB-dependent specs to use mocked data for CI stability

### Production Bug Fixes

- **Auth deadlock** — `auth-context.tsx` was `await`ing a Supabase query inside `onAuthStateChange`, deadlocking the auth-js LockManager on cold load; fixed with `getSession` + `setTimeout(0)` deferred resolution
- **Camera/QR** — 6 commits fixing WASM loading in production (served locally instead of CDN), v2 `IScannerError` handling, rear-camera constraint relaxation, decode vs. access error separation
- **Vercel build breaks** — `useSearchParams()` Suspense boundary fix, sidebar hydration mismatch
- **Sub-batch breadcrumb** — parent segment now links to parent batch detail instead of batches list
- **Recipe null params guard** — prevented crash when recipe `params` JSONB was null

---

## Key Technical Decisions I Made

1. **SWR over Redux/Zustand** — lightweight cache-first data fetching with automatic revalidation; no global state management overhead for a data-driven CRUD app
2. **RPC-first for state mutations** — all batch status transitions, mixing steps, and lot generation go through Supabase RPCs that validate business rules and write audit trails atomically, rather than client-side multi-step writes
3. **App-side alert generation over DB triggers** — pragmatic choice for a single-frontend POC; `scanAlerts()` runs on read, deduplicates via `dedup_key`, and auto-resolves cleared conditions
4. **Mocked E2E tests** — Playwright tests intercept all Supabase REST calls, making the test suite deterministic, fast (~5s after first run), and safe for a live production database
5. **Vertical form over wizard** — rewrote the process logging UI from a multi-step wizard to a single scrolling form where all sections are visible but dimmed until prerequisites are met, reducing clicks and improving operator efficiency

---

## Metrics

| Metric | Value |
|--------|-------|
| Total commits (mine) | 143 / 223 (64%) |
| Lines added (mine) | 43,000+ |
| TypeScript/TSX files authored | 105+ |
| Test files authored | 29 |
| E2E test scenarios | 128+ passing, 1 skipped |
| Database tables | 23 tables, 6 views |
| RLS policies authored | 76 across 24 tables |
| Database RPCs | 7 |
| SQL migration files | 25 |
| Pages / routes | 15+ |
| Production deployment | Live on Vercel, client actively using |

---

## What the Other Team Members Built

For completeness / to clarify scope boundaries:

- **Subra (33 commits):** Mixing operator page UI (initial component scaffolding — `MixingOperatorPage`, `TimerCard`, `StepHistory`, `AddStepModal`), design specs, recipe panel, lot generation UI, reports date filter, QR code printing, Operator auth gates, genealogy map initial canvas
- **Jonny (25 commits):** Identity header status RPC wiring, process run closure, profile settings/passcode, avatar upload, maintenance type persistence, camera error messages + build fix, machine QR deep-link, sprint3 test suite reorganisation
- **Ethan (22 commits):** Raw material intake completeness + dashboard KPI expansion, QR scanner hookup on process step page, process timeline schema alignment, history toggle, sprint 5 batch features, simplified ratio recipe mode

I integrated, reviewed, and merged all teammate contributions, resolved merge conflicts, and maintained the reference documentation as the single source of truth.

---

## Links

- **Live production:** Deployed on Vercel (client-facing, URL not public)
- **Repository:** GitHub (private) — `LutfilHaady/FlintDeploy`
