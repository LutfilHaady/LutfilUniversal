# AI Collections Agent - Setup Checklist

## ✅ Code Complete
All code is built and ready. Here's what else needs to be done:

---

## 📋 Setup Checklist

### 1. **Install Dependencies** (When ready to use real APIs)
```bash
npm install openai twilio
```

**Note:** Code works without these - it will use mocks. Install only when you have API credentials.

---

### 2. **Environment Variables**

Create `.env.local` file (copy from `.env.example`):

```env
# Required for production
DATABASE_URL="your-database-url"
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"

# Optional - Add when ready
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_VOICE_FROM=+1234567890
CRON_SECRET=random-secret-string
```

---

### 3. **Database Schema** ✅
Already done! The schema has:
- `Call` model
- `CollectionAttempt` model
- Invoice fields: `lastCollectionAttempt`, `collectionStatus`

**Action:** Run migrations if needed:
```bash
npm run db:push
```

---

### 4. **Set Up Cron Job** ⭐ DO THIS FIRST

#### Step 1: Test Locally (No Deployment Needed)
```bash
# 1. Start your dev server
npm run dev

# 2. In another terminal, test the cron endpoint
curl http://localhost:3000/api/cron/collections

# Or use the test script (Node 18+)
node scripts/test-collections-cron.js
```

**Expected Output:**
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

Check console logs for mock messages!

#### Step 2: Deploy & Set Up Production Cron

**Option A: Vercel Cron (Recommended - Easiest)**
1. ✅ `vercel.json` is already configured
2. Deploy to Vercel: `vercel --prod`
3. Cron runs automatically every hour - **DONE!**

**Option B: External Cron Service**
Use a free service:
- **cron-job.org** - https://cron-job.org (free)
- **EasyCron** - https://www.easycron.com (free tier)
- **GitHub Actions** - If using GitHub

**Setup:**
- URL: `https://your-app.vercel.app/api/cron/collections`
- Method: GET
- Schedule: Every hour (`0 * * * *`)
- Optional: Add header `Authorization: Bearer YOUR_CRON_SECRET`

**Option C: Manual Testing (Development)**
Just call the endpoint when needed:
```bash
curl https://your-app.vercel.app/api/cron/collections
```

---

### 5. **Twilio Setup** (When ready)

#### Step 1: Get Twilio Account
1. Sign up at https://www.twilio.com/try-twilio
2. Get Account SID and Auth Token from dashboard

#### Step 2: Set Up WhatsApp
1. Go to Twilio Console > Messaging > WhatsApp Senders
2. Request WhatsApp sender number (or use sandbox for testing)
3. Copy the number (format: `whatsapp:+14155238886`)
4. Add to `.env` as `TWILIO_WHATSAPP_FROM`

#### Step 3: Set Up Voice Number
1. Go to Twilio Console > Phone Numbers > Buy a number
2. Buy a number (or use trial number for testing)
3. Copy the number (format: `+1234567890`)
4. Add to `.env` as `TWILIO_VOICE_FROM`

#### Step 4: Configure Webhooks
1. Go to Twilio Console > Phone Numbers > Manage > Active Numbers
2. Click on your voice number
3. Under "Voice & Fax":
   - **A CALL COMES IN:** Leave blank (we handle this in code)
   - **STATUS CALLBACK URL:** `https://your-app.com/api/calls/status`
4. Save

**Note:** For local testing, use ngrok:
```bash
ngrok http 3000
# Use the ngrok URL in webhook configuration
```

---

### 6. **OpenAI Setup** (When ready)

1. Sign up at https://platform.openai.com/
2. Go to API Keys section
3. Create new API key
4. Add to `.env` as `OPENAI_API_KEY`

**Note:** 
- Uses GPT-3.5-turbo (cost-effective)
- Falls back to mocks if not configured
- Estimated cost: ~$2/month for 1000 invoices

---

### 7. **Test the System**

#### Test with Mocks (No API Keys Needed)
```bash
# 1. Start dev server
npm run dev

# 2. Trigger collection manually
curl -X POST http://localhost:3000/api/collections/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "your-invoice-id",
    "attemptType": "both"
  }'

# 3. Check console logs for mock messages
# 4. Check database for created records
```

#### Test with Real APIs
1. Add API credentials to `.env`
2. Install dependencies: `npm install openai twilio`
3. Restart dev server
4. Trigger collection
5. Check Twilio dashboard for sent messages/calls

---

### 8. **Monitor & Debug**

#### Check Collection History
```bash
GET /api/collections/history?invoiceId=invoice-id
GET /api/collections/history?supplierId=supplier-id
```

#### Check Logs
- Console logs show all collection attempts
- Database records in `CollectionAttempt` and `Call` tables
- Twilio dashboard shows sent messages/calls (if configured)

---

## 🚨 Important Notes

### Local Development with Twilio
- Twilio webhooks need public URLs
- Use **ngrok** for local testing:
  ```bash
  ngrok http 3000
  # Use ngrok URL in NEXT_PUBLIC_APP_URL
  ```

### Rate Limiting
- Max 1 collection attempt per invoice per 24 hours
- Built into the scheduler logic

### Error Handling
- All errors are logged to console
- Failed attempts are recorded in database
- System continues processing other invoices even if one fails

### Cost Management
- Monitor Twilio usage in dashboard
- Monitor OpenAI usage in dashboard
- Estimated: ~$84/month for 1000 invoices

---

## 📊 What Happens When

### T-3 (3 days before due)
- ✅ WhatsApp message sent
- Tone: Friendly

### T-1 (1 day before due)
- ✅ WhatsApp message sent
- ✅ Voice call initiated
- Tone: Friendly

### T+0 (Due date)
- ✅ WhatsApp message sent
- ✅ Voice call initiated
- Tone: Professional

### T+1 (1 day overdue)
- ✅ WhatsApp message sent
- ✅ Voice call initiated
- Tone: Urgent

### T+3 (3 days overdue)
- ✅ WhatsApp message sent
- ✅ Voice call initiated
- Tone: Urgent

### T+7 (7 days overdue)
- ✅ WhatsApp message sent
- ✅ Voice call initiated
- Tone: Firm

### T+14+ (14+ days overdue)
- ✅ Voice call prioritized
- ✅ WhatsApp message sent
- Tone: Escalated

---

## ✅ Ready to Go!

Once you:
1. ✅ Add environment variables (when ready)
2. ✅ Install dependencies (when ready)
3. ✅ Set up cron job
4. ✅ Configure Twilio webhooks (when ready)

The system will automatically:
- Find invoices needing collection
- Generate appropriate messages
- Send via WhatsApp and/or voice calls
- Track everything in database
- Escalate tone based on days overdue

---

## 🆘 Troubleshooting

### Mocks not working?
- Check console logs
- Verify database connection
- Check invoice exists in database

### Real APIs not working?
- Verify environment variables are set
- Check API keys are valid
- Verify dependencies installed: `npm install openai twilio`
- Check Twilio webhook URLs are correct

### Cron not running?
- Verify `vercel.json` is deployed
- Check Vercel cron job is enabled
- For external cron, verify URL is accessible
- Check `CRON_SECRET` matches if using authentication

---

**Questions?** Check the code comments or console logs for detailed error messages.

