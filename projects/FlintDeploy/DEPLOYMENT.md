# Flint Labs Frontend — Vercel Deployment Guide

This repo is a **Next.js 16 (App Router)** app — not a static site. The previous Vercel
deployment served a static HTML file, so the Vercel project settings need to be switched
over to the Next.js framework. The code is already pushed to `main`; Vercel auto-deploys
`main` as production. You just need to fix the project **Build settings** and add
**Environment Variables**, then redeploy.

Estimated time: ~10 minutes.

---

## 0. Prerequisites — get the Supabase keys

You need three values from the Supabase dashboard of the project
`pewrwrqituidyxhfsner` (**Supabase → Project Settings → API**):

| Value | Where | Notes |
|-------|-------|-------|
| Project URL | "Project URL" | `https://pewrwrqituidyxhfsner.supabase.co` |
| **anon / public key** | "Project API keys" → `anon` `public` | ⚠️ Use the **legacy JWT** key — a long string starting with **`eyJ…`**. **Do NOT** use the newer `sb_publishable_…` key — the app hangs silently with it. |
| **service_role key** | "Project API keys" → `service_role` `secret` | Secret. Used server-side for the `/admin` user-management screen. Never expose to the browser. |

> If you can't see the legacy `eyJ…` anon key, in newer Supabase dashboards click
> "Legacy API keys" / "JWT-based keys" to reveal it.

---

## 1. Fix the Vercel Build & Development settings

In the Vercel dashboard → your project → **Settings → Build and Deployment** (or
"General" → "Build & Development Settings"):

| Setting | Set to |
|---------|--------|
| **Framework Preset** | **Next.js** (it was probably "Other" / static) |
| **Build Command** | Leave default (`next build`) — toggle the override OFF |
| **Output Directory** | Leave default — **toggle the override OFF**. The old static deploy likely forced this to `.` / `public` / a folder; it must be unset so Vercel uses Next's `.next`. |
| **Install Command** | Leave default (`npm install`) |
| **Root Directory** | Leave blank (the app lives at the repo root, where `package.json` is) |
| **Node.js Version** | **20.x** or **22.x** (Settings → General). Next 16 needs Node ≥ 18.18; use 20+. |

There is no `vercel.json` in the repo, so all configuration is driven by these dashboard
settings.

---

## 2. Add Environment Variables

Vercel → Settings → **Environment Variables**. Add these for **Production**
(and Preview, so preview deploys work too):

| Name | Value | Scope |
|------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pewrwrqituidyxhfsner.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **`eyJ…` legacy JWT anon key** from step 0 | All |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role secret** from step 0 | All |
| `NEXT_PUBLIC_INSTANCE_ID` | `SG-PROD-01` (optional — shown on the login screen) | All |

> `NEXT_PUBLIC_*` vars are exposed to the browser (that's expected for the URL + anon key).
> `SUPABASE_SERVICE_ROLE_KEY` has **no** `NEXT_PUBLIC_` prefix on purpose — keep it server-only.

---

## 3. Point Supabase Auth at the Vercel domain (recommended)

Supabase → **Authentication → URL Configuration**:
- Set **Site URL** to your Vercel production URL (e.g. `https://flint-labs.vercel.app`).
- Add the same URL under **Redirect URLs**.

Login uses email+password (no email redirect), so this isn't strictly required to log in,
but setting it avoids auth edge cases and is good hygiene.

---

## 4. Redeploy

Settings changes don't redeploy automatically. Either:
- **Deployments** tab → latest deployment → **⋯ → Redeploy**, or
- push any commit to `main`.

Watch the build log — it should end with `✓ Compiled successfully` and a route list
(≈17 routes). The warning `The "middleware" file convention is deprecated… use "proxy"`
is **cosmetic** — ignore it.

---

## 5. Post-deploy smoke test

Open the production URL and verify:

1. **`/`** redirects to **`/login`**.
2. Log in with a test account:
   - Engineer: `dev.engineer@flintlabs.com` / `Test1234`
   - Admin: `dev.admin@flintlabs.com` / `Test1234`
3. After login you land on **`/dashboard`** and KPIs render.
4. Click into **Batches**, **Machines**, **Recipes**, **Reports** — pages load (no infinite spinner).
5. **`/admin`** (as the Admin account): the Users tab loads and you can add a user.
   - If adding a user fails → `SUPABASE_SERVICE_ROLE_KEY` is missing/wrong.
6. If **any** Supabase data never loads / spins forever → the anon key is the wrong format
   (you used `sb_publishable_…` instead of the `eyJ…` JWT). Fix in step 2 and redeploy.

---

## 6. Known limitations to tell the client (unsupervised testing)

These are **expected**, not bugs:

- **Empty database.** The live DB has lookup data + (once step 7 is done) machines, but
  **no batches / runs / QC / lots** yet — testers start from a blank system and create their
  own data. (Seeding realistic demo data is a separate ~30-min task if they want to explore
  pre-filled data.)
- **QR camera pages** (`/scan`, `/log/process-step`) need a device with a camera and granted
  camera permission. On HTTPS (Vercel) the browser will prompt for camera access.
- **Not yet built:** auto "expected battery yield" calculation; bespoke per-process parameter
  forms for non-mixing steps (they use a generic form); PDF report export (CSV + Excel work);
  global search box.
- **Maintenance checklist** on the Machines page is not in this build (needs a DB migration first).

---

## 7. Make machines appear (one-time DB step)

The app reads machines from the live Supabase `equipment` table. If the **Machines** page is
empty after deploy, the live `equipment` table has no rows. Populate it once:

- Supabase → **SQL Editor** → paste and run the **equipment `INSERT`** block at the bottom of
  [`supabase/seed.sql`](supabase/seed.sql) (the 23 machines confirmed by Flint).
- It's idempotent (`ON CONFLICT (equipment_code) DO NOTHING`) — safe to run more than once.

> The other blocks in `seed.sql` (roles, processes, materials, QC definitions, permissions)
> are reference data that should already be present; only run them if you're standing up a
> brand-new database.

---

## Quick reference — what the build runs

| | |
|---|---|
| Build command | `next build` |
| Output | `.next` (Vercel handles automatically with the Next.js preset) |
| Node | 20.x / 22.x |
| Production branch | `main` |
| Required env | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (eyJ…), `SUPABASE_SERVICE_ROLE_KEY` |
