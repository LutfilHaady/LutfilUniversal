# Mock Data Backend Compatibility Report

## ✅ **GOOD - Already Backend Compatible**

### 1. Collections Mock Data (`lib/mock/collections.ts`)
- ✅ Uses TypeScript interfaces from `lib/types/collections.ts`
- ✅ Structure matches backend API response format
- ✅ All dates are ISO strings
- ✅ Enums are used correctly
- ⚠️ **ISSUE**: Has hardcoded IDs ('buyer1', 'supplier1') instead of real user IDs

### 2. TypeScript Interfaces (`lib/types/collections.ts`)
- ✅ Well-defined interfaces matching backend structure
- ✅ Optional fields marked correctly
- ✅ Relations structure matches Prisma schema

---

## ❌ **ISSUES FOUND - Need Fixing**

### 1. **Collections Mock Data - Hardcoded IDs**
**File:** `lib/mock/collections.ts`
**Issue:** Uses 'buyer1', 'supplier1', 'buyer2' instead of real user IDs
**Impact:** Backend will return real IDs like 'BJ1045', 'SP0023'
**Fix:** Replace with actual user IDs

### 2. **Invoices Page - Date Objects Instead of ISO Strings**
**File:** `app/invoices/page.tsx`
**Issue:** Uses `new Date('2024-01-15')` instead of ISO strings
**Impact:** Backend returns ISO strings like '2024-01-15T00:00:00.000Z'
**Fix:** Convert to ISO strings or use string format

### 3. **Invoices Page - Missing Collection Fields**
**File:** `app/invoices/page.tsx`
**Issue:** Mock data doesn't include `lastCollectionAttempt`, `collectionStatus`, `collectionAttempts`
**Impact:** Backend will return these fields
**Fix:** Add collection fields to mock data

### 4. **Dashboard - Mock Data Hardcoded in Component**
**File:** `app/dashboard/page.tsx`
**Issue:** Mock data defined directly in component, not using interfaces
**Impact:** Hard to replace with API calls
**Fix:** Extract to separate mock file with proper types

### 5. **Search Page - Mock Data Hardcoded in Component**
**File:** `app/search/page.tsx`
**Issue:** Mock data defined directly in component, date format inconsistent
**Impact:** Hard to replace with API calls
**Fix:** Extract to separate mock file with proper types

### 6. **Date Format Inconsistencies**
**Issues:**
- Some use Date objects
- Some use 'YYYY-MM-DD' strings
- Some use ISO strings
**Impact:** Backend will return ISO strings consistently
**Fix:** Standardize all dates to ISO strings

---

## 🔧 **FIXES NEEDED**

### Priority 1 (Critical - Collections)
1. Fix hardcoded IDs in `lib/mock/collections.ts`
2. Ensure all dates are ISO strings

### Priority 2 (Important - Invoices)
3. Update invoices mock data to include collection fields
4. Convert Date objects to ISO strings

### Priority 3 (Nice to Have - Organization)
5. Extract dashboard mock data to separate file
6. Extract search mock data to separate file
7. Create TypeScript interfaces for all mock data

---

## 📋 **BACKEND API EXPECTATIONS**

When backend is ready, API responses should match:

1. **Collections API** (`/api/collections/history`)
   - Returns: `CollectionHistoryResponse`
   - Dates: ISO strings
   - IDs: Real user IDs (BJ####, SP####)

2. **Invoices API** (`/api/invoices`)
   - Returns: `InvoiceWithCollections[]`
   - Includes: `lastCollectionAttempt`, `collectionStatus`, `collectionAttempts`
   - Dates: ISO strings

3. **Dashboard API** (`/api/dashboard/supplier`)
   - Returns: Supplier dashboard data
   - Dates: ISO strings
   - Should match TypeScript interface (to be created)

4. **Search API** (`/api/search?q=BJ1045`)
   - Returns: Buyer/Supplier profile
   - Dates: ISO strings
   - Should match TypeScript interface (to be created)

---

## ✅ **RECOMMENDATION**

1. **Fix collections mock data** (hardcoded IDs) - HIGH PRIORITY
2. **Update invoices mock data** (add collection fields) - HIGH PRIORITY
3. **Standardize date formats** (all ISO strings) - MEDIUM PRIORITY
4. **Extract mock data to separate files** - LOW PRIORITY (can be done later)

