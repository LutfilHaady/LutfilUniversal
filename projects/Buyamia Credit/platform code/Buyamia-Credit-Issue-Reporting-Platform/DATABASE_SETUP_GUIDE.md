# Database Setup Guide - Supabase Connection

## ✅ Your Current Status

- ✅ Tables already created in Supabase
- ✅ `DATABASE_URL` configured in `.env`
- ⚠️  Need to sync Prisma schema with database
- ⚠️  Need to generate Prisma client

---

## 🔧 Setup Steps

### Step 1: Pull Schema from Supabase (Sync Prisma with Database)

Since your tables already exist, pull the schema from Supabase to ensure Prisma matches:

```bash
npx prisma db pull
```

This will:
- Read your Supabase database structure
- Update `prisma/schema.prisma` to match your actual tables
- Ensure field names, types, and relationships are correct

**⚠️ Important:** Review the changes to `schema.prisma` after running this command.

---

### Step 2: Generate Prisma Client

Generate the Prisma client so your code can query the database:

```bash
npx prisma generate
```

This creates the TypeScript types and query methods based on your schema.

---

### Step 3: Test Database Connection

Test if Prisma can connect to your Supabase database:

```bash
npx prisma studio
```

This opens a visual database browser. If it connects, you're good! ✅

Or test via API:
```bash
curl http://localhost:3000/api/dashboard?userId=BJ1045&userType=BUYER
```

---

## 🔍 Verify Connection

### Check 1: Prisma Client Generated
```bash
ls node_modules/.prisma/client
```
Should show generated files.

### Check 2: Test Query
Create a test file `test-db.ts`:
```typescript
import { prisma } from './lib/prisma'

async function test() {
  try {
    const users = await prisma.user.findMany({ take: 1 })
    console.log('✅ Database connected!', users)
  } catch (error) {
    console.error('❌ Database error:', error)
  }
}

test()
```

Run: `npx tsx test-db.ts`

---

## 🐛 Common Issues & Fixes

### Issue 1: "PrismaClientInitializationError"
**Cause:** Database connection failed

**Fix:**
1. Verify `DATABASE_URL` in `.env` (not `.env.example`)
2. Check Supabase connection string format
3. Ensure Supabase allows connections from your IP
4. Test connection: `npx prisma db pull`

### Issue 2: "Table does not exist"
**Cause:** Schema mismatch between Prisma and database

**Fix:**
1. Run `npx prisma db pull` to sync schema
2. Check table names match (case-sensitive)
3. Verify all required tables exist in Supabase

### Issue 3: "Column does not exist"
**Cause:** Field names don't match

**Fix:**
1. Run `npx prisma db pull` to update schema
2. Check column names in Supabase match Prisma schema
3. Update Prisma schema if needed

### Issue 4: "Connection timeout"
**Cause:** Network/firewall issue

**Fix:**
1. Check Supabase allows external connections
2. Verify `DATABASE_URL` uses correct host/port
3. Check if SSL is required (`sslmode=require`)

---

## 📋 Quick Checklist

- [ ] Run `npx prisma db pull` to sync schema
- [ ] Review `prisma/schema.prisma` for any changes
- [ ] Run `npx prisma generate` to create client
- [ ] Test connection with `npx prisma studio`
- [ ] Verify API routes work (check browser console)
- [ ] Remove mock data fallbacks if database works

---

## 🔄 After Setup

Once connected, your API routes will automatically use the database:

- ✅ `/api/users/search` - Query users from database
- ✅ `/api/dashboard` - Get dashboard data from database
- ✅ `/api/invoices` - Fetch invoices from database
- ✅ `/api/collections/*` - Collection data from database

**Note:** The code already has fallback to mock data if database fails, so it will work either way.

---

## 📝 Next Steps

1. **Sync Schema:** `npx prisma db pull`
2. **Generate Client:** `npx prisma generate`
3. **Test Connection:** `npx prisma studio`
4. **Verify Data:** Check if queries return real data
5. **Remove Mock Fallbacks:** Once confirmed working (optional)

---

**Status:** Ready to connect! Just run the commands above. 🚀

