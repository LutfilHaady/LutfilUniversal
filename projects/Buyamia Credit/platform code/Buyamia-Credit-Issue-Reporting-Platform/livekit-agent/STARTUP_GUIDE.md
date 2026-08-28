# Buyamia Credit LiveKit Agent - Startup Guide

Complete guide to get your LiveKit agent up and running.

## Prerequisites

- **Python 3.9+** (3.11+ recommended)
- **LiveKit Account** - Sign up at https://cloud.livekit.io/ (free tier available)
- **OpenAI API Key** - Get from https://platform.openai.com/api-keys

## Quick Start (5 Minutes)

### Step 1: Setup Python Environment

```bash
# Navigate to agent directory
cd livekit-agent

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Windows (CMD):
venv\Scripts\activate.bat
# On Mac/Linux:
source venv/bin/activate
```

### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `livekit-agents[openai,silero]` - Core LiveKit Agents SDK (v1.2+) with OpenAI and Silero plugins
- `supabase` - Supabase client for database integration
- `python-dotenv` - Environment variable management

### Step 3: Configure Environment Variables

Create a `.env` file in the `livekit-agent` directory (or use the root `.env.local`):

```env
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Supabase Configuration (Optional - for real database queries)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

**Note:** If Supabase is not configured, the agent will use mock data for testing purposes.

**Getting Your LiveKit Credentials:**
1. Sign up at https://cloud.livekit.io/
2. Create a new project
3. Go to Settings → API Keys
4. Copy the URL, API Key, and API Secret

**Getting Your OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy and paste it into your `.env` file

### Step 4: Test the Agent

**Console Mode (Text-only testing):**

**Windows (Recommended - emojis disabled):**
```bash
# Option 1: Use helper script (disables emojis automatically)
.\run-console.bat     # Windows CMD
.\run-console.ps1     # PowerShell

# Option 2: Use text flag
python agent.py console --text
```

**Mac/Linux:**
```bash
python agent.py console
```

**Note:** Emojis are automatically disabled in the agent code. The helper scripts also set environment variables to prevent emoji output from LiveKit CLI.

This starts the agent in console mode where you can test it with text input.

**Development Mode (Voice + Text):**
```bash
python agent.py dev
```

This starts the agent in development mode with hot reloading.

**Production Mode:**
```bash
python agent.py start
```

This starts the agent in production mode.

## Testing the Agent

### Console Mode Testing

**Windows:**
1. Run: `.\run-console.bat` or `python agent.py console --text`
2. Wait for the agent to start
3. Type your questions in the console
4. Press Enter to send
5. The agent will respond using the tools

**Mac/Linux:**
1. Run: `python agent.py console`
2. Wait for the agent to start
3. Type your questions in the console
4. Press Enter to send
5. The agent will respond using the tools

**Example queries:**
```
> Show me my dashboard summary
> Which invoices are overdue?
> Get credit info for buyer BJ1123
> How are my collections performing?
> What's my risk analysis?
```

### Frontend Integration Testing

Once the agent is running, connect from your frontend:

1. Your frontend connects to the same LiveKit room
2. The agent automatically joins and responds
3. Use `@livekit/client` SDK in your frontend

See the Integration Guide below for frontend setup.

## Common Issues & Solutions

### Issue: "No module named 'dotenv'"

**Solution:** Make sure your virtual environment is activated and packages are installed:
```bash
.\venv\Scripts\Activate.ps1  # Windows PowerShell
pip install -r requirements.txt
```

### Issue: "Missing required environment variables"

**Solution:** Check that your `.env` file exists and contains all required variables:
```bash
# Check if .env file exists
ls .env  # or dir .env on Windows

# Verify variables are set
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.getenv('LIVEKIT_URL'))"
```

### Issue: "Failed to connect to LiveKit"

**Solution:**
1. Verify your `LIVEKIT_URL` is correct (should start with `wss://`)
2. Check your API key and secret are correct
3. Ensure your LiveKit project is active

### Issue: "OpenAI API error"

**Solution:**
1. Verify your `OPENAI_API_KEY` is correct
2. Check you have credits in your OpenAI account
3. Verify the API key has the correct permissions

## Project Structure

```
livekit-agent/
├── agent.py              # Main agent code
├── requirements.txt      # Python dependencies
├── .env                  # Environment variables (create this)
├── .env.example          # Example environment file
├── README.md             # Documentation
└── STARTUP_GUIDE.md      # This file
```

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js UI    │────▶│    LiveKit      │────▶│  Python Agent   │
│   (Frontend)    │◀────│    Cloud/Server │◀────│  (This Agent)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  Database/Tools │
                                                │  (Future)       │
                                                └─────────────────┘
```

## Agent Features

### Available Tools

1. **get_dashboard_summary** - Get dashboard metrics for suppliers or buyers
2. **get_invoice_details** - Get invoice information filtered by status
3. **get_buyer_credit_info** - Get credit information for specific buyers
4. **get_collection_stats** - Get collection statistics and performance
5. **get_risk_analysis** - Get portfolio risk analysis

### Capabilities

- **Voice & Text** - Supports both voice conversations and text chat
- **Function Calling** - Uses tools to fetch and process data
- **Natural Language** - Conversational, easy-to-understand responses
- **Multi-language** - Responds in Indonesian or English

## Next Steps

### 1. Connect to Real Database

Currently, the agent uses mock data. To connect to your real database:

1. Uncomment database dependencies in `requirements.txt`
2. Add database connection code in tool functions
3. Replace mock data returns with actual database queries

### 2. Deploy to Production

**Option A: LiveKit Cloud (Recommended)**
- Deploy directly to LiveKit Cloud
- Automatic scaling and management
- See: https://docs.livekit.io/agents/cloud/

**Option B: Docker**
- Build Docker image
- Deploy to your infrastructure
- See: https://docs.livekit.io/agents/deployment/

### 3. Frontend Integration

Connect your Next.js frontend to the agent:

```bash
# In your frontend project
npm install @livekit/client
```

See the Integration Guide for detailed frontend setup.

## Command Reference

| Command | Description |
|---------|-------------|
| `python agent.py console` | Test in console mode (text-only) |
| `python agent.py dev` | Run in development mode |
| `python agent.py start` | Run in production mode |
| `python agent.py download-files` | Download required model files |

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `LIVEKIT_URL` | Yes | LiveKit server URL (wss://...) |
| `LIVEKIT_API_KEY` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit API secret |
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4 |

## Getting Help

- **LiveKit Docs**: https://docs.livekit.io/agents/
- **LiveKit Discord**: https://discord.gg/livekit
- **LiveKit GitHub**: https://github.com/livekit/agents

## Verification Checklist

Before deploying, verify:

- [ ] Python 3.9+ installed
- [ ] Virtual environment created and activated
- [ ] All dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` file created with all required variables
- [ ] Agent starts without errors (`python agent.py console`)
- [ ] Can send messages and receive responses
- [ ] All tools are working correctly

---

**Ready to start?** Follow the Quick Start guide above!

