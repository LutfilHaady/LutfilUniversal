@echo off
REM Run agent in console mode with Windows-friendly encoding
REM This disables emojis and avoids encoding issues on Windows

cd /d "%~dp0"

REM Force deactivate any active virtual environment
set VIRTUAL_ENV=
set PYTHONPATH=

REM Use full path to system Python (where packages are installed)
REM Default system Python location on Windows
set PYTHON_EXE=C:\Users\lutfi\AppData\Local\Programs\Python\Python312\python.exe

REM Verify Python exists, otherwise fall back to python command
if not exist "%PYTHON_EXE%" set PYTHON_EXE=python

REM Disable emojis and colors in output
set NO_COLOR=1
set TERM=dumb
set FORCE_COLOR=0

REM Set UTF-8 encoding for the console
chcp 65001 >nul 2>&1

REM Set environment variable for Python
set PYTHONIOENCODING=utf-8

REM Run the agent in console mode with text flag
"%PYTHON_EXE%" agent.py console --text

pause

