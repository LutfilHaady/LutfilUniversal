# Comprehensive Score Calculation System

## Overview

This document describes the comprehensive credit score and reliability score calculation system implemented for the Buyamia Credit Platform.

## Credit Score (Buyers)

### Calculation Formula

The credit score is calculated using a weighted combination of three components:

1. **Payment History (40% weight)**
   - On-time payment rate
   - Late payment rate
   - Overdue invoice rate
   - Defaulted invoice rate

2. **Payment Behavior (30% weight)**
   - Average payment delay (for late payments)
   - Payment consistency (late payment frequency)

3. **Risk Factors (30% weight)**
   - Defaulted invoice rate
   - Overdue invoice rate

### Score Updates

Credit scores are automatically recalculated when:
- An invoice is marked as PAID (recalculates based on all payment history)
- An invoice status changes to OVERDUE_3, OVERDUE_7, or DEFAULTED
- Periodic daily recalculation (via cron job)

### Score Range
- **0-100**: Higher is better
- **Default**: 50 (starting score for new users)

## Reliability Score (Suppliers)

### Calculation Formula

The reliability score is calculated using a weighted combination of three components:

1. **Order Fulfillment (40% weight)**
   - Order completion rate
   - On-time delivery rate

2. **Issue Management (35% weight)**
   - Issue rate (fewer issues = better)
   - Issue resolution rate
   - Open issues penalty
   - Issue type penalties (wrong items, delays, damaged items)

3. **Delivery Performance (25% weight)**
   - On-time delivery rate
   - Average delivery time

### Score Updates

Reliability scores are automatically recalculated when:
- An issue is created (recalculates based on all order/issue history)
- An issue status changes (especially when resolved)
- Periodic daily recalculation (via cron job)

### Score Range
- **0-100**: Higher is better
- **Default**: 50 (starting score for new users)

## Implementation Details

### Files Created

1. **`lib/utils/score-calculation.ts`**
   - Core calculation functions
   - `calculateCreditScore()` - Calculates buyer credit score
   - `calculateReliabilityScore()` - Calculates supplier reliability score
   - Helper functions for each component

2. **`lib/utils/score-recalculation.ts`**
   - Recalculation functions that fetch all historical data
   - `recalculateBuyerCreditScore()` - Recalculates single buyer
   - `recalculateSupplierReliabilityScore()` - Recalculates single supplier
   - Batch functions for all users

3. **`app/api/cron/scores/route.ts`**
   - Periodic score recalculation endpoint
   - Can be scheduled as a cron job

### Files Modified

1. **`app/api/invoices/route.ts`**
   - Updated PATCH endpoint to use comprehensive calculation
   - Recalculates score when invoice is paid or defaulted

2. **`app/api/issues/route.ts`**
   - Recalculates supplier reliability score when issue is created

3. **`app/api/issues/[id]/route.ts`**
   - Recalculates supplier reliability score when issue status changes

4. **`lib/jobs/collections-scheduler.ts`**
   - Updates invoice statuses based on days overdue
   - Recalculates credit scores when invoices become overdue/defaulted

## Score Calculation Examples

### Credit Score Example

**Buyer with:**
- 10 total invoices
- 8 paid on time
- 1 paid late (5 days delay)
- 1 overdue (3 days)
- 0 defaulted

**Calculation:**
- Payment History: 80% on-time, 10% late, 10% overdue → ~65 points
- Payment Behavior: 5 days average delay, 10% late rate → ~60 points
- Risk Factors: 10% overdue rate → ~90 points
- **Final Score**: (65 × 0.4) + (60 × 0.3) + (90 × 0.3) = **71**

### Reliability Score Example

**Supplier with:**
- 20 total orders
- 18 completed
- 15 on-time deliveries
- 3 issues (2 resolved, 1 open)
- 1 wrong items issue
- 7 days average delivery time

**Calculation:**
- Fulfillment: 90% completion, 83% on-time → ~87 points
- Issue Management: 15% issue rate, 67% resolution, 5% wrong items → ~75 points
- Delivery Performance: 83% on-time, 7 days average → ~70 points
- **Final Score**: (87 × 0.4) + (75 × 0.35) + (70 × 0.25) = **78**

## Periodic Recalculation

Scores are recalculated daily via cron job at `/api/cron/scores`. This ensures:
- Scores stay accurate even if some events are missed
- Historical data changes are reflected
- Data consistency across the system

## Migration Notes

For existing users:
- Run `recalculateAllBuyerCreditScores()` to update all buyer scores
- Run `recalculateAllSupplierReliabilityScores()` to update all supplier scores
- Or wait for the daily cron job to update them automatically

## Testing

To test the calculation system:
1. Create test invoices and mark them as paid/overdue
2. Create test issues for suppliers
3. Verify scores update correctly
4. Check score history in the database

## Future Enhancements

Potential improvements:
- Add time decay (recent events weighted more)
- Add volume weighting (larger orders count more)
- Add seasonal adjustments
- Add industry-specific scoring
- Add machine learning for predictive scoring

