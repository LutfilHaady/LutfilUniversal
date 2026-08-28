# Phase 1: Basic Setup - Testing Instructions

## ✅ What's Included in Phase 1

- ✅ Project structure (Next.js 14 + TypeScript)
- ✅ Tailwind CSS with Buyamia color palette
- ✅ Landing page (`/`)
- ✅ Basic navigation structure
- ✅ All UI pages (using mock data - no database yet)

## 🚀 How to Test

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Generate Prisma Client (Optional for Phase 1)
```bash
npx prisma generate
```
*Note: This might show a warning about DATABASE_URL, but that's OK for Phase 1. We'll set up the database later.*

### Step 3: Start Development Server
```bash
npm run dev
```

### Step 4: Open Browser
Navigate to: **http://localhost:3000**

## 🧪 What to Test

1. **Landing Page** (`/`)
   - Should show "Buyamia Credit Platform" title
   - Two registration cards (Buyer & Supplier)
   - Login link at bottom
   - Colors should be green/cream/beige theme

2. **Navigation**
   - Click "Register as Buyer" → Should go to `/register?type=buyer`
   - Click "Register as Supplier" → Should go to `/register?type=supplier`
   - Click "Login" → Should go to `/login`

3. **Visual Check**
   - Colors match Buyamia palette (green #4C6A4F, cream #F7F4EF, beige #E8E3D9)
   - Fonts are clean and readable
   - Cards have rounded corners and soft shadows
   - Responsive layout (try resizing browser)

## ⚠️ Expected Behavior

- ✅ Pages should load without errors
- ✅ Navigation should work
- ✅ Styling should be applied correctly
- ⚠️ Forms won't submit yet (no backend)
- ⚠️ Data is mock/static (no database)

## 🐛 If You See Errors

**Error: Cannot find module '@prisma/client'**
- Run: `npx prisma generate`

**Error: Module not found**
- Make sure you ran `npm install`

**Port 3000 already in use**
- Change port: `npm run dev -- -p 3001`

---

**Once Phase 1 looks good, let me know and we'll move to Phase 2!** 🎉

