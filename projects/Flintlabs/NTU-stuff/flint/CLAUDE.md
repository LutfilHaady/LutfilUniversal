# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run all commands from inside the `flint/` directory:

```bash
npm run dev      # dev server at http://localhost:3000 (Turbopack)
npm run build    # production build
npm run lint     # ESLint
```

No test runner is configured.

## Architecture

### Project layout

The repository root (`NTU-stuff/`) contains only the `flint/` subdirectory, which is the entire Next.js application. The path alias `@/` maps to `flint/` (configured in `tsconfig.json`).

```
flint/
  app/          # Next.js App Router pages
  components/   # Shared UI components
  lib/data.ts   # Single source of truth — all types, enums, mock data, color tokens
```

### Shell layout

Every page uses the same structure:

```tsx
<Shell title="Page Title" headerActions={<button>...</button>}>
  <main>...</main>
</Shell>
```

`Shell` (`components/shell.tsx`) composes `<Sidebar>` + `<Header>` + children. To add a custom breadcrumb instead of a plain title, pass `titleNode` instead of `title`. Header action buttons (e.g. "New Batch") are passed via `headerActions`.

### Status system

Two backend enums are defined in `lib/data.ts`:

- `BatchStatus`: `InProgress | Released | OnHold | Quarantine | Scrapped`
- `ProcessRunStatus`: `InProgress | AwaitingQC | Passed | Failed | Overridden`

`Released` and `Scrapped` are terminal — `TERMINAL_STATUSES` and `BATCH_STATUS_TRANSITIONS` encode valid moves. `StatusBadge` resolves display label + color from `ALL_STATUS_TONES`, which merges both enums. Never hardcode status colors — always derive from the tones map.

### Data layer

`lib/data.ts` exports everything: types, status tones, transition rules, and all mock data (`SUB_BATCHES`, `MAIN_BATCHES`, `LOTS`, `SUBBATCH_DETAIL`, `PROCESS_ROUTE`, `TIMELINE`, `GENEALOGY`). No API integration exists yet — pages import mock data directly.

### Styling

Tailwind v4 with `@theme inline` in `globals.css`. Key tokens:

| Token | Value | Use |
|---|---|---|
| `#0a0a0a` | bg | Page background |
| `#111111` | card | Card / table surface |
| `#2a2a2a` | border | Default border |
| `#22c55e` | accent | Green — primary actions, success |
| `#f5f5f5` | fg | Primary text |
| `#888888` | muted | Secondary text |
| `#5a5a5a` | subtle | Tertiary text / icons |

Use `font-mono` + `num-tnum` class on all IDs, serials, and numeric measurements for tabular alignment.

Google Fonts are loaded via `<link>` tags in `app/layout.tsx` — **not** via `@import` in CSS. PostCSS expands `@import "tailwindcss"` to thousands of lines first, so any `@import url(...)` after it breaks the CSS parser.

### Known gotcha — expandable table rows

When a `map()` renders both a main row and a collapsible detail row, use `<Fragment key={id}>` (imported from React), not bare `<>`. Without a key on the fragment, React loses track of rows and expand/collapse breaks silently.

### Turbopack workspace root

`next.config.ts` sets `turbopack.root` explicitly to prevent Turbopack from picking up a `package-lock.json` in a parent directory and resolving packages from the wrong location.
