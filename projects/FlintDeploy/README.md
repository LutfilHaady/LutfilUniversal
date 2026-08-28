# Flint Labs — Traceability Frontend

A batch‑tracing and quality‑control system for Flint Labs' POC battery production line. Operators log process steps, engineers run QC and trace batch genealogy, and admins manage users and equipment.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth) · SWR · Playwright

---

## 👋 Inheriting this repo? Read this first

This frontend was built against a **specific Supabase project that belongs to the original team** (`pewrwrqituidyxhfsner.supabase.co`). **You will not have access to it, and you should not depend on it.**

**You must stand up your own Supabase project (or any Postgres backend) before this app will do anything useful.** Out of the box you can run the UI, but every login, batch, recipe, and report will fail until you point it at a database you control and recreate the schema. The good news: the full schema and seed data are checked in under [`supabase/`](supabase/), so this is a few CLI commands, not a reverse‑engineering job.

What "set up your own DB" involves, in order:

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine for development).
2. **Recreate the schema and RPCs.** The full migration history (23 tables, 6 views + `audit_log`, 4 enums, indexes, the 6 RPCs, and the auth trigger) is checked in under [`supabase/migrations/`](supabase/migrations/). Link your project and run `supabase db push` — see [`supabase/README.md`](supabase/README.md) for the exact commands. The app calls the RPCs directly and **will not work without them**.
3. **Seed reference data.** Run [`supabase/seed.sql`](supabase/seed.sql) to populate the lookup tables (roles, processes, materials, QC check definitions, role permissions). Equipment and demo batches are not included — see that file's header.
4. **Create test accounts.** See §13 and §14 of [`docs/FLINT_REFERENCE_21052026.md`](docs/FLINT_REFERENCE_21052026.md) for the exact 3‑step SQL required to insert working auth users (there are non‑obvious GoTrue requirements — read the warnings there). The role UUIDs in that snippet match `seed.sql`.
5. **Wire your env vars** (next section).

> ⚠️ **Heads‑up on the anon key:** use the **legacy JWT anon key** (the long `eyJ…` token from Dashboard → Settings → API), **not** the newer `sb_publishable_*` key. `@supabase/ssr` does not support the publishable format and requests hang silently. This has bitten people before.

---

## Quick start (once you have a database)

```bash
# 1. Install dependencies
npm install

# 2. Install the Playwright browser (first time on this machine only)
npx playwright install chromium

# 3. Configure environment
cp .env.local.example .env.local
#    then fill in the values — see below

# 4. Run the dev server
npm run dev          # http://localhost:3000
```

### Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | **Change this to your own project URL.** The example file still has the original team's URL — overwrite it. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Your project's **legacy JWT** anon key (`eyJ…`). |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ for `/admin` | **Not in the example file.** Server‑side only (used by `app/actions/admin-users.ts` for user management). Never expose this client‑side. Get it from Dashboard → Settings → API. |
| `NEXT_PUBLIC_API_URL` | — | Optional. If set, data fetching uses real HTTP against this base URL; if absent, the mock data layer (`lib/data.ts`) is used. |
| `NEXT_PUBLIC_INSTANCE_ID` | — | Label shown on the login page. Defaults to `SG-PROD-01`. |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the Playwright suite (auto‑starts dev server, logs in once, runs all specs) |
| `npm run test:report` | Open the last Playwright HTML report |

---

## Project layout

```
app/            Next.js App Router pages & server actions
  actions/      Server actions (admin user management — uses service role key)
  admin/  alerts/  batches/  log/  login/  lots/  machines/
  qc-override/  recall/  recipes/  reports/  scan/
components/     Shared UI components
lib/
  supabase.ts       Supabase browser client
  auth-context.tsx  Auth provider + useAuth() hook
  hooks/            SWR data hooks (useBatches, useDashboard, useAlerts, …)
  data.ts           Mock data layer (used when NEXT_PUBLIC_API_URL is unset)
  types.ts          Shared TypeScript types
  constants.ts      Process/QC param field definitions
middleware.ts   Route-level RBAC (gates /admin, /reports, /recall by role)
docs/           ⭐ Single source of truth — read FLINT_REFERENCE first
tests/          Playwright specs (see tests/sprint3 for templates)
```

---

## ⭐ The most important docs

This repo's real documentation lives in `docs/`, not here:

- **[`docs/FLINT_REFERENCE_21052026.md`](docs/FLINT_REFERENCE_21052026.md)** — the single source of truth: full DB schema, column‑name corrections, process routes, role permissions, QC logic, RPC signatures, env setup, test‑account SQL, and the running list of integration gaps. **Read this before touching the data layer or any feature.**
- **[`docs/SESSION_LOG.md`](docs/SESSION_LOG.md)** — chronological log of what changed each working session.
- **[`CLAUDE.md`](CLAUDE.md)** — conventions and workflow rules for this codebase (also a good orientation for human contributors).

---

## Conventions worth knowing

- **Never key off `batch_number`.** It's a unique TEXT field, not the primary key — the PK is a UUID `id`. Only QR‑scan lookups use `WHERE batch_number = $1`.
- **Always change batch status through the `transition_batch_status` RPC**, never a direct `PATCH` — it validates the state machine and writes the audit row atomically.
- **Column names:** use the actual DB names in the schema‑corrections table at the top of the reference doc, not names from any older design doc — the old names will error.
- **Supabase returns snake_case**; the frontend uses camelCase. Map at the data‑layer / query‑hook boundary.
- **RLS is intentionally disabled** in development (all tables wide open). Do not add RLS workarounds — proper policies are a pre‑go‑live task (reference §10, task 3A).

---

## Testing

Playwright is the project's test framework and tests are part of the definition of done for every change. Mock all Supabase REST calls with `page.route()` — **never write real data to the database in tests**. See `tests/sprint3/` for templates and `CLAUDE.md` for the mocking rules (notably: stateless mocks only — auth effects fire twice on load).

```bash
npm test
```

---

## Current status (as of 2026‑06‑03)

The frontend prototype is feature‑complete on mock data, with many pages already wired to Supabase (mixing, QC logging, QC override, recipes, machines, reports, recall genealogy, admin users/audit). Known gaps — alerts generation/wiring, a main‑batch detail page, sub‑batch creation, RLS, per‑item QC and calibration flows — are tracked in [`docs/FLINT_REFERENCE_21052026.md`](docs/FLINT_REFERENCE_21052026.md) §12. Check there for the live picture rather than trusting this paragraph.

---

## Recommended first task

Stand up your own database from [`supabase/migrations/`](supabase/migrations/) + [`supabase/seed.sql`](supabase/seed.sql) (see [`supabase/README.md`](supabase/README.md)), then create a test account and confirm you can log in and load the batches page. Once your DB is live and the env vars point at it, work through the open gaps tracked in [`docs/FLINT_REFERENCE_21052026.md`](docs/FLINT_REFERENCE_21052026.md) §12 — RLS, alerts wiring, the main‑batch detail page, and sub‑batch creation are the big ones.

> The migration files reproduce the source project's history rather than a squashed baseline. After go‑live you may want to squash them into one initial migration — but don't bother while the schema is still moving.
