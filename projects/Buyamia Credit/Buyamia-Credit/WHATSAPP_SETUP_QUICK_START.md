# 🚀 WhatsApp Collections - Quick Setup Guide

**Goal:** Get automated WhatsApp messages working for buyers approaching their due dates within 2 hours.

---

## ✅ What's Already Done

1. ✅ Code is updated to **only send WhatsApp messages** (no calls)
2. ✅ Collections orchestrator with AI message generation
3. ✅ Scheduler that runs every hour via cron
4. ✅ Database schema ready
5. ✅ API endpoints ready

---

## 📋 What You Need to Do (2 Hours)

### Step 1: Install Dependencies (5 minutes)

```bash
npm install twilio openai
```

**Note:** If you get permission errors, try:
- `sudo npm install twilio openai` (macOS/Linux)
- Or install globally: `npm install -g twilio openai`

---

### Step 2: Get Twilio Account & WhatsApp Number (30 minutes)

#### 2.1 Sign Up for Twilio
1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free trial account
3. Verify your email and phone number

#### 2.2 Get WhatsApp Sender Number
1. Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message
2. You'll get a sandbox number like: `whatsapp:+14155238886`
3. **For production:** Go to Messaging → WhatsApp Senders → Request WhatsApp sender
4. Copy your WhatsApp number (format: `whatsapp:+14155238886`)

#### 2.3 Get API Credentials
1. Go to Twilio Console → Account → API Keys & Tokens
2. Copy:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "View" to reveal)

---

### Step 3: Get OpenAI API Key (10 minutes)

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Go to API Keys section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-...`)

**Note:** You'll need to add payment method to OpenAI account (they charge per API call, but very cheap - ~$2/month for 1000 invoices)

---

### Step 4: Add Environment Variables (5 minutes)

Add these to your `.env.local` file (or `.env`):

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# OpenAI Configuration
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# App URL (for production, use your Vercel URL)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Cron Secret (for securing cron endpoint)
CRON_SECRET=your-random-secret-string-here
```

**Important:**
- Replace all placeholder values with your actual credentials
- For local testing: `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- For production: `NEXT_PUBLIC_APP_URL=https://your-app.vercel.app`

---

### Step 5: Test Locally (10 minutes)

#### 5.1 Start Dev Server
```bash
npm run dev
```

#### 5.2 Test Collection Trigger
In another terminal, trigger a collection manually:

```bash
# Replace INVOICE_ID with an actual invoice ID from your database
curl -X POST http://localhost:3000/api/collections/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "YOUR_INVOICE_ID",
    "attemptType": "whatsapp_message"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "results": [
    {
      "type": "whatsapp_message",
      "messageId": "SM...",
      "status": "sent"
    }
  ],
  "toneLevel": "friendly",
  "invoiceNumber": "INV-001",
  "daysOverdue": 0,
  "daysUntilDue": 3
}
```

#### 5.3 Check Console Logs
You should see:
```
[Twilio] WhatsApp message sent: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 5.4 Check WhatsApp
The buyer should receive a WhatsApp message in Bahasa Indonesia!

---

### Step 6: Test Cron Job (10 minutes)

#### 6.1 Test Cron Endpoint Locally
```bash
curl http://localhost:3000/api/cron/collections
```

**Expected Response:**
```json
{
  "success": true,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "processed": 5,
  "attempted": 2,
  "skipped": 3,
  "errors": 0
}
```

#### 6.2 Set Up Production Cron

**Option A: Vercel Cron (Easiest - Already Configured!)**
1. Deploy to Vercel: `vercel --prod`
2. The cron job is already configured in `vercel.json`
3. It will run automatically every hour at minute 0

**Option B: External Cron Service**
1. Go to https://cron-job.org (free)
2. Create account
3. Add new cron job:
   - **URL:** `https://your-app.vercel.app/api/cron/collections`
   - **Schedule:** Every hour (`0 * * * *`)
   - **Method:** GET
   - **Optional:** Add header `Authorization: Bearer YOUR_CRON_SECRET`

---

### Step 7: Verify Everything Works (10 minutes)

#### 7.1 Check Database
```bash
# Check collection attempts
npx prisma studio
# Navigate to CollectionAttempt table
```

#### 7.2 Check Twilio Dashboard
1. Go to Twilio Console → Monitor → Logs → Messaging
2. You should see sent WhatsApp messages

#### 7.3 Check OpenAI Usage
1. Go to OpenAI Dashboard → Usage
2. You should see API calls for message generation

---

## 🎯 How It Works

### Collection Timeline

| Days | Action | Tone |
|------|--------|------|
| **T-3** (3 days before due) | WhatsApp message | Friendly |
| **T-1** (1 day before due) | WhatsApp message | Friendly |
| **T+0** (Due date) | WhatsApp message | Professional |
| **T+1** (1 day overdue) | WhatsApp message | Urgent |
| **T+3** (3 days overdue) | WhatsApp message | Urgent |
| **T+7** (7 days overdue) | WhatsApp message | Firm |
| **T+14+** (14+ days overdue) | WhatsApp message | Escalated |

### Message Flow

1. **Cron job runs** every hour (`/api/cron/collections`)
2. **Scheduler finds** invoices needing collection
3. **AI generates** personalized message in Bahasa Indonesia
4. **Twilio sends** WhatsApp message to buyer
5. **Database records** the attempt

---

## 🐛 Troubleshooting

### Messages Not Sending?

1. **Check Twilio credentials:**
   ```bash
   # Verify in .env.local
   echo $TWILIO_ACCOUNT_SID
   echo $TWILIO_AUTH_TOKEN
   ```

2. **Check phone number format:**
   - Must be in E.164 format: `+6281234567890`
   - No spaces or dashes

3. **Check Twilio sandbox:**
   - For testing, buyer must join Twilio sandbox first
   - Send "join [your-sandbox-code]" to Twilio WhatsApp number

4. **Check console logs:**
   - Look for error messages in terminal
   - Check Twilio dashboard for failed messages

### OpenAI Not Working?

1. **Check API key:**
   ```bash
   echo $OPENAI_API_KEY
   ```

2. **Check OpenAI account:**
   - Ensure payment method is added
   - Check usage limits

3. **Fallback:**
   - System uses mock messages if OpenAI fails
   - Check console for "using mock response" messages

### Cron Not Running?

1. **Check Vercel deployment:**
   - Ensure `vercel.json` is deployed
   - Check Vercel dashboard → Cron Jobs

2. **Test manually:**
   ```bash
   curl https://your-app.vercel.app/api/cron/collections
   ```

3. **Check logs:**
   - Vercel dashboard → Functions → Logs

---

## 💰 Cost Estimate

**For 1000 invoices/month:**
- **Twilio WhatsApp:** ~$5/month (5000 messages × $0.005)
- **OpenAI GPT-3.5:** ~$2/month (5000 messages × $0.0004)
- **Total: ~$7/month**

**Very affordable!** 🎉

---

## ✅ Checklist

- [ ] Installed `twilio` and `openai` packages
- [ ] Got Twilio Account SID and Auth Token
- [ ] Got Twilio WhatsApp number
- [ ] Got OpenAI API key
- [ ] Added all environment variables to `.env.local`
- [ ] Tested collection trigger manually
- [ ] Verified WhatsApp message received
- [ ] Set up production cron job
- [ ] Tested cron endpoint
- [ ] Verified everything works!

---

## 🚀 You're Done!

The system will now automatically:
- ✅ Find invoices approaching due dates
- ✅ Generate personalized WhatsApp messages in Bahasa Indonesia
- ✅ Send messages via Twilio
- ✅ Track everything in database
- ✅ Escalate tone based on days overdue

**Next Steps:**
- Monitor collection attempts in database
- Check Twilio dashboard for delivery status
- Adjust message templates if needed

---

## 📞 Need Help?

- Check console logs for detailed error messages
- Check Twilio dashboard for message status
- Check OpenAI dashboard for API usage
- Review `AI_COLLECTIONS_SETUP.md` for more details

**Good luck! 🎉**

