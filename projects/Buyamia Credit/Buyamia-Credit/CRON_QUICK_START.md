# ⚡ Cron Job Quick Start

## ✅ Everything is Ready!

Your cron job is **already set up** and ready to use. Here's how to activate it:

---

## 🚀 3 Ways to Run the Cron Job

### Option 1: Vercel (Automatic - Recommended)
```bash
# Just deploy!
vercel --prod
```
**Done!** Cron runs automatically every hour.

---

### Option 2: Test Locally (Right Now)
```bash
# Terminal 1
npm run dev

# Terminal 2
curl http://localhost:3000/api/cron/collections
```

**See it work immediately!** Check console for mock messages.

---

### Option 3: External Cron Service
1. Go to https://cron-job.org (free)
2. Add job:
   - URL: `https://your-app.vercel.app/api/cron/collections`
   - Schedule: Every hour
3. Save

---

## ✅ What You'll See

**Success Response:**
```json
{
  "success": true,
  "processed": 5,
  "attempted": 2,
  "skipped": 3,
  "errors": 0
}
```

**Console Logs:**
```
[Cron] Starting collection queue processing...
[Collections Scheduler] Found 5 invoices to check
[MOCK Twilio] Would send WhatsApp message: ...
```

**Database:**
- `CollectionAttempt` records created
- `Call` records created (if voice calls triggered)

---

## 🎯 That's It!

- ✅ Code is ready
- ✅ Works with mocks (no API keys needed)
- ✅ Just deploy or test locally
- ✅ Add API credentials later when ready

**No other setup needed!** The cron job will work immediately.

---

## 📚 More Details

- Full setup guide: `AI_COLLECTIONS_SETUP.md`
- Detailed cron guide: `CRON_SETUP_GUIDE.md`

