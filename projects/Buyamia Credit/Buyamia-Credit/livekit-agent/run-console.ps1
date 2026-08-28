# Run agent in console mode with Windows-friendly encoding
# This disables emojis and avoids encoding issues on Windows

Set-Location $PSScriptRoot

# Deactivate any active virtual environment
$env:VIRTUAL_ENV = $null
$env:PYTHONPATH = $null

# Remove venv from PATH if it exists
if ($env:PATH -like "*\.venv\Scripts*") {
    $env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notlike "*\.venv\Scripts*" }) -join ';'
}

# Use system Python explicitly (where packages are installed)
$pythonExe = "C:\Users\lutfi\AppData\Local\Programs\Python\Python312\python.exe"

# If system Python doesn't exist, try to find it
if (-not (Test-Path $pythonExe)) {
    $pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $pythonExe) {
        Write-Host "[ERROR] Python not found. Please install Python or update the path in this script." -ForegroundColor Red
        exit 1
    }
}

# Disable emojis and colors in output
$env:NO_COLOR = "1"
$env:TERM = "dumb"
$env:FORCE_COLOR = "0"

# Set UTF-8 encoding for the console
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

# Run the agent in console mode with text flag
& $pythonExe agent.py console --text
