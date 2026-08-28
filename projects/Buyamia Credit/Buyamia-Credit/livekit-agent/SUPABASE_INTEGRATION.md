# Supabase Integration Guide

The agent now supports Supabase integration for real-time database queries.

## Setup

### 1. Install Supabase Client

```bash
pip install supabase
```

### 2. Configure Environment Variables

Add to your `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

**Note:** The agent works without Supabase (uses mock data for testing). Supabase is optional but recommended for production.

## Database Schema Requirements

The agent expects the following tables in your Supabase database:

### Users Table
- `id` (string/uuid)
- `userId` (string) - e.g., "BJ1123"
- `businessName` (string)
- `type` (string) - "BUYER" or "SUPPLIER"
- `creditScore` (integer)
- `creditLimit` (number, optional)

### Invoices Table
- `id` (string/uuid)
- `invoiceNumber` (string)
- `amount` (number)
- `status` (string) - "PENDING", "PAID", "DUE_SOON", "OVERDUE_3", "OVERDUE_7", "DEFAULTED"
- `buyerId` (string, foreign key to users)
- `supplierId` (string, foreign key to users)

### Collection Attempts Table (Optional)
- `id` (string/uuid)
- `invoiceId` (string, foreign key to invoices)
- `status` (string) - "PENDING", "IN_PROGRESS", "PAID", "ESCALATED"
- `createdAt` (timestamp)

## Tool Functions

All tools automatically use Supabase if configured, otherwise fall back to mock data:

1. **get_dashboard_summary** - Queries `invoices` table
2. **get_buyer_credit_info** - Queries `users` table (type='BUYER')
3. **get_invoice_details** - Queries `invoices` table with status filter
4. **get_collection_stats** - Queries `collection_attempts` table (if exists)
5. **get_risk_analysis** - Queries `users` table (type='BUYER') for credit scores

## Testing Without Supabase

The agent works perfectly fine without Supabase configured - it will use mock data. This is useful for:
- Development and testing
- When Supabase is not yet set up
- Quick demonstrations

## Production Setup

For production:
1. Set up Supabase database with the required tables
2. Configure environment variables
3. Test queries to ensure data access works
4. The agent will automatically use real data

## Status Mapping

The agent maps between user-friendly status names and database values:

- "overdue" → `["OVERDUE_3", "OVERDUE_7", "DEFAULTED"]`
- "paid" → `["PAID"]`
- "pending" → `["PENDING", "DUE_SOON"]`
- "all" → All statuses

This matches the Prisma schema status enums in your database.



