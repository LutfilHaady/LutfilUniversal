# AI Collections Agent - Implementation Guide

## Overview

The AI Collections Agent automatically sends WhatsApp messages and makes voice calls to collect overdue invoices. All code is built with **mocks first** - it will work without API credentials, then automatically use real APIs when credentials are added.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Collections Scheduler (Cron Job)                       │
│  - Finds invoices needing collection                    │
│  - Determines timing (T-3, T-1, T+0, etc.)             │
└──────────────────┬──────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  API: /api/collections/trigger                          │
│  - Receives invoice ID                                 │
│  - Calls AI Orchestrator                               │
│  - Sends via Twilio (or mocks)                         │
└──────────────────┬──────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│  AI Orchestrator │   │  Twilio          │
│  - Tone Level    │   │  Integration     │
│  - Message Gen   │   │  - WhatsApp      │
│  - Script Gen    │   │  - Voice Calls   │
└──────────────────┘   └──────────────────┘
```

## Files Created

### Core Logic
- `lib/ai/collections-orchestrator.ts` - AI message/script generation
- `lib/utils/collections.ts` - Date calculations, timing logic
- `lib/jobs/collections-scheduler.ts` - Finds invoices to collect

### Integrations
- `lib/integrations/twilio.ts` - Twilio API wrapper (mocked if no credentials)

### API Endpoints
- `app/api/collections/trigger/route.ts` - Trigger collection attempt
- `app/api/collections/history/route.ts` - Get collection history
- `app/api/calls/connect/route.ts` - Twilio webhook (when call connects)
- `app/api/calls/status/route.ts` - Twilio webhook (call status updates)

## How It Works

### 1. **Tone Determination**
Based on days overdue:
- **T-3 to T-1**: `FRIENDLY` - Gentle reminders
- **T+0**: `PROFESSIONAL` - Due date reminder
- **T+1 to T+3**: `URGENT` - Immediate payment needed
- **T+4 to T+7**: `FIRM` - Final notice
- **T+14+**: `ESCALATED` - Account review

### 2. **Collection Timeline**
- **T-3** (3 days before): WhatsApp message only
- **T-1** (1 day before): WhatsApp + Voice call
- **T+0** (due date): WhatsApp + Voice call
- **T+1** (1 day overdue): WhatsApp + Voice call
- **T+3** (3 days overdue): WhatsApp + Voice call
- **T+7** (7 days overdue): WhatsApp + Voice call
- **T+14+** (14+ days overdue): Voice call priority

### 3. **Mock vs Real APIs**

**Without API Credentials:**
- OpenAI: Returns realistic mock messages in Bahasa Indonesia
- Twilio: Logs what would be sent (console output)

**With API Credentials:**
- Automatically uses real OpenAI API
- Automatically uses real Twilio API
- No code changes needed!

## Usage

### Manual Trigger
```typescript
// Trigger collection for a specific invoice
POST /api/collections/trigger
{
  "invoiceId": "invoice-id",
  "attemptType": "both" // or "whatsapp_message" or "whatsapp_call"
}
```

### Scheduled Collection (Cron Job)
```typescript
import { processCollectionQueue } from '@/lib/jobs/collections-scheduler'

// Run every hour
await processCollectionQueue()
```

### Get Collection History
```typescript
GET /api/collections/history?invoiceId=invoice-id
GET /api/collections/history?supplierId=supplier-id&page=1&limit=20
```

## Environment Variables

Add these when ready to use real APIs:

```env
# OpenAI (optional - uses mocks if not set)
OPENAI_API_KEY=sk-...

# Twilio (optional - uses mocks if not set)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_VOICE_FROM=+1234567890

# App URL (for webhooks)
NEXT_PUBLIC_APP_URL=https://your-app.com
```

## Installing Dependencies

When ready to use real APIs, install:

```bash
npm install openai twilio
```

The code will automatically detect if these are installed and configured.

## Testing

### Test with Mocks (No API Keys Needed)
1. Create a test invoice in database
2. Call `/api/collections/trigger` with invoice ID
3. Check console logs for mock messages
4. Verify database records are created

### Test with Real APIs
1. Add API credentials to `.env`
2. Install dependencies: `npm install openai twilio`
3. Call `/api/collections/trigger`
4. Check Twilio dashboard for sent messages/calls

## Next Steps

1. ✅ Code is complete and ready
2. ⏳ Test with mock data
3. ⏳ Set up cron job for scheduler
4. ⏳ Add API credentials when ready
5. ⏳ Monitor and iterate

## Notes

- All messages are in **Bahasa Indonesia**
- Calls are recorded automatically (if Twilio configured)
- Collection attempts are logged in database
- Rate limiting: Max 1 attempt per invoice per 24 hours
- Tone escalates automatically based on days overdue

