---
name: flintdeploy-env-setup
description: FlintDeploy is a separate deploy clone with no committed node_modules or .env.local — where to get them to run tests
metadata: 
  node_type: memory
  type: project
  originSessionId: fce3aeac-0419-4d59-acb7-62b47b1fd78a
---

The working dir `C:\Users\lutfi\OneDrive\Desktop\Coding\FlintDeploy` is a deploy-focused clone that ships **without** `node_modules` or `.env.local`. To run `npm test` / `npm run build` you must first `npm install`, then provide `.env.local`.

The working `.env.local` for the Flint Supabase project (`pewrwrqituidyxhfsner`) lives at:
`C:\Users\lutfi\OneDrive\Desktop\Coding\New folder\flint-labs-frontend\.env.local`
(copy it in — it has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_INSTANCE_ID`; it's gitignored).

Without `.env.local` the dev server's middleware throws *"Your project's URL and Key are required"* and the Playwright webServer times out — so the whole suite fails before any test runs. The test login setup (`tests/global.setup.ts`) authenticates against the **real** Supabase with the dev accounts, so the real anon key is required even though individual tests mock REST calls.

**Gotcha (2026-06-08):** the copied `.env.local` does **not** include `SUPABASE_SERVICE_ROLE_KEY`. Any Admin user-management action (`app/actions/admin-users.ts`) throws *"Missing Supabase admin env vars"* without it — both locally and on Vercel Production (the client hit this on Add-User). Fix: add the service_role secret (Supabase → Settings → API) to `.env.local` **and** the Vercel dashboard (no `NEXT_PUBLIC_` prefix), then redeploy. Server-only — never commit it.

Also note: the Playwright global setup waits 15s for `/login`→`/dashboard`; on a **cold** dev-server start the first run can flake (compile + live login), passes on re-run once warm. And `tests/sprint3/sprint3-workflows.spec.ts › Process Timeline Rendering` is a known pre-existing red test in this clone (reads drifted live sub-batch data), unrelated to local changes.
