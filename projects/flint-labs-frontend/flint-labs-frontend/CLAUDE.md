# Claude Code — Flint Labs Frontend

## Session startup (required)

At the start of every session, before taking any action:

1. Read [`docs/FLINT_REFERENCE_21052026.md`](docs/FLINT_REFERENCE_21052026.md) in full.
2. After reading, state in 3–5 bullet points what is relevant to the current session based on:
   - Outstanding gaps and integration phases not yet complete
   - Any backend schema corrections that apply to the work at hand
   - Role/permission constraints that affect the feature being touched
3. Then proceed with whatever the user has asked.

This file is the single source of truth for the codebase — architecture, schema, process routes, QC logic, and phase status all live there.

---

## Session log (append on each session)

Maintain a running log at [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md). At the **end of each session** (or before context is compacted), append an entry:

```
## [YYYY-MM-DD] — <one-line summary of session>
- What changed: <files edited, features added/fixed>
- Gaps closed: <any items from FLINT_REFERENCE that are now done>
- New gaps found: <anything discovered that isn't in the reference yet>
- Ref doc updated: yes / no
```

---

## Updating FLINT_REFERENCE_21052026.md

Before the context window is compacted (or at session end), update [`docs/FLINT_REFERENCE_21052026.md`](docs/FLINT_REFERENCE_21052026.md) to reflect:

- Phase status changes (e.g. a phase moved from 🔴 to 🟡)
- New schema corrections discovered during implementation
- Gaps that have been closed by work done this session
- New gaps uncovered during implementation
- The **Last updated** date at the top of the file

Do **not** rewrite the entire document — make targeted edits to the relevant sections only.

---

## Before pushing to GitHub (required)

Before running `git push` for any commit, you **must**:

1. Append an entry to [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md) covering all changes made since the last push — files edited, features added/fixed, gaps closed, new gaps found.
2. Update [`docs/FLINT_REFERENCE_21052026.md`](docs/FLINT_REFERENCE_21052026.md) to reflect any phase status changes, schema corrections, closed gaps, or new gaps discovered. At minimum, bump the **Last updated** date.
3. Include the updated docs in the same commit as the code changes, or in an immediately preceding commit on the same push.

**Do not push code without updating both docs first.** The docs are the team's shared context — stale docs cause merge conflicts and duplicate work.

---

## Testing with Playwright (required for every sprint)

Playwright is already installed (`@playwright/test` in devDependencies). Every sprint must include Playwright tests that verify the sprint's changes. This is not optional — it is part of the definition of done.

### First time on this machine

Run once to install the Chromium browser binary:

```
npx playwright install chromium
```

### Running the test suite

```
npm test
```

This starts the dev server automatically, logs in once (saving the session to `tests/.auth/engineer.json` — gitignored), then runs all tests. The first run takes ~15 seconds; subsequent runs reuse the saved session and finish in ~5 seconds.

### Adding tests for your sprint

1. Create `tests/<your-sprint-folder>/<page-name>.spec.ts` — follow the existing files in `tests/sprint3/` as a template.
2. Mock all Supabase REST calls using `page.route()` — **do not write real data to the database in tests**.
3. Cover at minimum: page renders correctly, key validation states (disabled buttons, error messages), and the happy-path flow end-to-end.
4. Run `npm test` and confirm all tests (including existing ones) pass before pushing.

### Key rules for writing mocks

- Use `**https://pewrwrqituidyxhfsner.supabase.co/rest/v1/<table>**` as the route pattern.
- **Do not use a call counter** to vary mock responses — `AuthProvider` fires `fetchResults`-style effects twice on page load (getSession + onAuthStateChange both call setUser). Stateless mocks only.
- Always mock `POST` → `201`, `PATCH` → `204`, `GET` with `.single()` → JSON object, `GET` without → JSON array.
- Do not mock `/rest/v1/users` — leave that real so the auth context resolves the correct role.

### If the test suite already covers your page

Check `tests/` first. If tests exist for your page, run them and confirm they still pass after your changes. Add new tests only for behaviour that isn't already covered.

---

## General rules

- Never query the database using `batch_number` as a primary key — always use UUID `id`. Scan lookups use `WHERE batch_number = $1`.
- Always use the actual column names from the schema corrections table in the reference doc, not names from any earlier design doc.
- RLS is intentionally disabled during development. Do not add RLS workarounds until Phase 5 begins.
- The frontend is Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. Match these conventions.
