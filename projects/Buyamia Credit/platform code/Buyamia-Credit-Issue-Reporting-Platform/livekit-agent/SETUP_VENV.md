# Setting Up Virtual Environment (Optional)

If you want to use a virtual environment instead of system Python:

## Quick Setup

```bash
cd livekit-agent

# Remove old venv if it exists and is incomplete
rmdir /s /q venv

# Create new venv
python -m venv venv

# Activate venv
venv\Scripts\activate.bat

# Install packages
pip install -r requirements.txt

# Now you can use the venv
python agent.py console --text
```

## Current Setup

**Currently using system Python** - All packages are installed globally and working fine. You don't need a venv unless you want to isolate dependencies.

## Using System Python (Current)

The batch files will use system Python by default, which already has all packages installed. This is working fine.

If you activate the venv manually, the batch files will use that instead.



