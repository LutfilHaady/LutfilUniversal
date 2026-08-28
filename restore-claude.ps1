<#
  Restores Claude Code configuration onto this PC.
  Usage:  .\restore-claude.ps1          (restore)
          .\restore-claude.ps1 -DryRun  (show what would happen)
#>
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$repo   = Split-Path -Parent $MyInvocation.MyCommand.Path
$src    = Join-Path $repo 'claude-config'
$dest   = Join-Path $HOME '.claude'
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'

if (-not (Test-Path $src)) { throw "claude-config/ not found next to this script." }

function Say($m) { Write-Host $m }
function Copy-Part($name, $from, $to) {
    if (-not (Test-Path $from)) { Say "  skip  $name (not in repo)"; return }
    if ($DryRun) { Say "  would restore  $name"; return }
    $parent = Split-Path -Parent $to
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    Copy-Item -Path $from -Destination $to -Recurse -Force
    Say "  restored  $name"
}

Say ""
Say "Claude config restore  ->  $dest"
if ($DryRun) { Say "(dry run - nothing will be written)" }
Say ""

# --- Back up anything already there -------------------------------------
if ((Test-Path $dest) -and -not $DryRun) {
    $backup = Join-Path $HOME ".claude-backup-$stamp"
    Say "Backing up existing ~/.claude  ->  $backup"
    Copy-Item -Path $dest -Destination $backup -Recurse -Force
}
if ((Test-Path "$HOME\.claude.json") -and -not $DryRun) {
    Copy-Item "$HOME\.claude.json" "$HOME\.claude.json.backup-$stamp" -Force
    Say "Backing up existing ~/.claude.json"
}
Say ""

# --- Restore ------------------------------------------------------------
Say "Restoring:"
Copy-Part 'settings.json'      (Join-Path $src 'claude\settings.json') (Join-Path $dest 'settings.json')
Copy-Part 'personal skills'    (Join-Path $src 'claude\skills')        $dest
Copy-Part 'plugins'            (Join-Path $src 'claude\plugins')       $dest
Copy-Part 'conversation history' (Join-Path $src 'claude\projects')    $dest
Copy-Part 'prompt history'     (Join-Path $src 'claude\history.jsonl') (Join-Path $dest 'history.jsonl')
Copy-Part 'tasks'              (Join-Path $src 'claude\tasks')         $dest
Copy-Part 'jobs'               (Join-Path $src 'claude\jobs')          $dest
Copy-Part 'app state (.claude.json)' (Join-Path $src 'claude.json')    (Join-Path $HOME '.claude.json')

# --- Extra skill collections -------------------------------------------
$extra = Join-Path $src 'extra-skills'
if (Test-Path $extra) {
    Say ""
    Say "Extra skill collections available (not auto-installed):"
    Get-ChildItem $extra -Directory | ForEach-Object { Say "  - $($_.Name)" }
    Say "  To use one, copy the individual skill folders you want into ~/.claude/skills/"
}

Say ""
Say "Done."
Say ""
Say "NEXT STEPS:"
Say "  1. Run 'claude' and log in - credentials were deliberately NOT transferred."
Say "  2. Re-authorize MCP connectors (Notion, Slack, Linear, etc.) via /mcp."
Say "  3. Plugins were copied; if any misbehave, reinstall with /plugin."
Say ""
