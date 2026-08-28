# LutfilUniversal — laptop → PC transfer

Private repo carrying my Claude Code setup and active coding projects to a new machine.

## Setup on the PC

```powershell
git clone https://github.com/LutfilHaady/LutfilUniversal.git
cd LutfilUniversal
.\restore-claude.ps1
```

Run `.\restore-claude.ps1 -DryRun` first if you want to see what it touches.
It backs up any existing `~/.claude` to `~/.claude-backup-<timestamp>` before writing.

Then:
1. Run `claude` and log in — **credentials were deliberately not transferred.**
2. Re-authorize MCP connectors (Notion, Slack, Linear, Asana, Atlassian, ClickUp, Monday) via `/mcp`.
3. Plugins are copied as-is; if any misbehave, reinstall via `/plugin`.

## What's here

### `claude-config/` — the Claude Code setup

| Path | What |
|---|---|
| `claude/settings.json` | Model, effort level, enabled plugins, marketplaces, TUI prefs |
| `claude/skills/` | 24 personal skills (resume/career toolkit, `senior-frontend`, `database-designer`) |
| `claude/plugins/` | superpowers, playwright, context7, vercel-plugin + marketplace config |
| `claude/projects/` | Conversation transcripts — past sessions stay searchable |
| `claude/history.jsonl` | Prompt history |
| `claude/tasks/`, `claude/jobs/` | Background task and job state |
| `claude.json` | App state: onboarding flags, per-project history, skill usage |
| `extra-skills/` | Two standalone collections (88 skills) — **not** auto-installed; copy what you want into `~/.claude/skills/` |

### `projects/` — coding projects

`2006-SCE1-64` · `Brainhack 2026` · `Buyamia Credit` · `Databusters 2026` · `Dell Hackathon 2026`
`Flint` · `FlintDeploy` · `Flintlabs` · `flint-labs-frontend` · `Invoice Procurement OCR`
`PDF compressor` · `Timesheet` · `TTSH Intern` · `birthday-site-natasha` · `natasha-site-deploy`

See [`projects/NESTED-REPOS.md`](projects/NESTED-REPOS.md) — several of these were their own git
repos. Their working files are here (including work uncommitted at transfer time), but their local
history is not; that file lists each remote so you can re-clone if you want the history back.

## Deliberately excluded

- **Credentials** — `.credentials.json`, `daemon/*.key`. Log in fresh on the PC.
- **`.env` files** — recreate from each project's `.env.example`.
- **Runtime noise** — shell snapshots, paste cache, file history, session env, telemetry, caches.
- **`node_modules/`, `.venv/`, build output** — reinstall with `npm install` / `pip install -r requirements.txt`.
- **Beginner code** (`Coding/`) — left on the laptop: practice scripts, LinkedIn Learning course
  files, duplicate zips. The two useful skill collections in it were rescued into `claude-config/extra-skills/`.
