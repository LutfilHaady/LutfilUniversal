# Cron Job Setup Guide - Quick Start

## ✅ What's Already Done
- ✅ Cron endpoint created: `/app/api/cron/collections/route.ts`
- ✅ Vercel config created: `vercel.json`
- ✅ Code works with mocks (no API keys needed)

## 🚀 Quick Setup (3 Steps)

### Step 1: Test Locally
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Test the cron endpoint
curl http://localhost:3000/api/cron/collections
```

**What to expect:**
- ✅ Returns JSON with results
- ✅ Console shows mock messages
- ✅ Database records created

### Step 2: Deploy to Vercel
```bash
# If not already deployed
vercel --prod
```

**That's it!** Vercel will automatically:
- Read `vercel.json`
- Set up cron job
- Run every hour automatically

### Step 3: Verify It's Working
1. Go to Vercel Dashboard
2. Your Project → Settings → Cron Jobs
3. You should see: `/api/cron/collections` running every hour

**Or check logs:**
- Vercel Dashboard → Your Project → Logs
- Look for `[Cron] Starting collection queue processing...`

---

## 🧪 Testing Without Deployment

### Test Locally
```bash
# Start server
npm run dev

# Test endpoint (in another terminal)
curl http://localhost:3000/api/cron/collections
```

### Test on Production
```bash
curl https://your-app.vercel.app/api/cron/collections
```

---

## 🔧 Alternative: External Cron Service

If not using Vercel, use a free cron service:

### cron-job.org (Free)
1. Sign up at https://cron-job.org
2. Create new cron job:
   - **URL:** `https://your-app.vercel.app/api/cron/collections`
   - **Schedule:** Every hour
   - **Method:** GET
3. Save - done!

### EasyCron (Free Tier)
1. Sign up at https://www.easycron.com
2. Add new cron job:
   - **URL:** `https://your-app.vercel.app/api/cron/collections`
   - **Schedule:** `0 * * * *` (every hour)
3. Save - done!

---

## 🔐 Security (Optional)

To secure your cron endpoint, add to `.env`:
```env
CRON_SECRET=your-random-secret-here
```

Then configure your cron service to send header:
```
Authorization: Bearer your-random-secret-here
```

**Note:** Vercel Cron doesn't need this - it's automatically secured.

---

## ✅ Verification Checklist

- [ ] Tested locally - endpoint returns success
- [ ] Deployed to Vercel (or set up external cron)
- [ ] Cron job appears in Vercel dashboard
- [ ] Checked logs - see processing messages
- [ ] Verified database - CollectionAttempt records created

---

## 🐛 Troubleshooting

### "Cannot GET /api/cron/collections"
- Make sure dev server is running
- Check the route file exists

### "No invoices found"
- This is normal if no invoices need collection
- Create a test invoice with due date in past

### Cron not running on Vercel
- Check `vercel.json` is in root directory
- Redeploy: `vercel --prod`
- Check Vercel dashboard for cron job status

### External cron not working
- Verify URL is correct
- Check if site is accessible
- Verify cron service is actually calling the URL

---

## 📊 What Happens When Cron Runs

1. Finds invoices needing collection (T-3, T-1, T+0, T+1, etc.)
2. For each invoice:
   - Generates message/script (mock if no OpenAI)
   - Logs what would be sent (mock if no Twilio)
   - Creates database records
3. Returns summary of processed invoices

**All without API credentials!** It just uses mocks.

---

## 🎯 Next Steps

1. ✅ Set up cron job (you are here)
2. ⏳ Test and verify it works
3. ⏳ Add API credentials when ready
4. ⏳ System automatically switches to real APIs

---

**That's it!** Your cron job is ready to run. It will work with mocks until you add API credentials.

