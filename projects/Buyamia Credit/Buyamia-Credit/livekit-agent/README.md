# Buyamia Credit - AI Database Assistant

A text-based AI chatbot that queries the Buyamia Credit database and returns summaries in plain, conversational English.

## Setup

### 1. Install Dependencies

```bash
cd livekit-agent
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `LIVEKIT_URL` - Your LiveKit server URL
- `LIVEKIT_API_KEY` - LiveKit API key
- `LIVEKIT_API_SECRET` - LiveKit API secret
- `OPENAI_API_KEY` - OpenAI API key for GPT-4

### 3. Run the Agent

```bash
python agent.py dev
```

The agent will connect to LiveKit and wait for participants to join.

## Features

The AI assistant can help with:

1. **Dashboard Summaries** - Get an overview of business health
2. **Invoice Details** - Check paid, pending, or overdue invoices
3. **Buyer Credit Info** - View credit scores and payment history
4. **Collection Stats** - Monitor collection performance
5. **Risk Analysis** - Assess portfolio risk

## Example Queries

- "Show me my dashboard summary"
- "Which invoices are overdue?"
- "What's the credit score for Hotel Grand Indonesia?"
- "How are my collections performing?"
- "Which buyers are high risk?"

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js UI    │────▶│    LiveKit      │────▶│  Python Agent   │
│   (Chat UI)     │◀────│    Server       │◀────│  (GPT-4 + Tools)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   Supabase DB   │
                                                │  (Buyamia Credit)│
                                                └─────────────────┘
```
