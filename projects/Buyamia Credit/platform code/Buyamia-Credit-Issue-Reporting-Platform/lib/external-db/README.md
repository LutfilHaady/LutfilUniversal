# External Database Adapter

This module provides **read-only** access to the main Buyamia database for fetching buyer, seller, and order data.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Credit Platform                      │
│  ┌──────────────┐      ┌──────────────────────────────────┐ │
│  │  Local DB    │      │     External DB Adapter          │ │
│  │  (SQLite)    │      │  ┌────────────────────────────┐  │ │
│  │              │      │  │ lib/external-db/           │  │ │
│  │  - Users     │      │  │ ├── client.ts (pg pool)    │  │ │
│  │  - Invoices  │      │  │ ├── types.ts              │  │ │
│  │  - Issues    │      │  │ └── adapters/             │  │ │
│  │  - etc.      │      │  │     ├── buyers.ts         │  │ │
│  └──────────────┘      │  │     ├── sellers.ts        │  │ │
│                        │  │     └── orders.ts         │  │ │
│                        │  └────────────────────────────┘  │ │
│                        └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                    │
                                    │ Read-Only
                                    ▼
                    ┌───────────────────────────────┐
                    │     Buyamia Main Database     │
                    │        (PostgreSQL)           │
                    │  ┌─────────┐  ┌────────────┐  │
                    │  │ public  │  │procurement │  │
                    │  │ schema  │  │  schema    │  │
                    │  └─────────┘  └────────────┘  │
                    └───────────────────────────────┘
```

## Setup

### 1. Environment Variable

Add to your `.env` file:

```env
EXTERNAL_DATABASE_URL="postgresql://postgres:password@host:5432/database?sslmode=disable"
```

### 2. Dependencies

The `pg` package is already installed. Types are in `@types/pg`.

## Usage

### Import the Module

```typescript
import { externalDb } from '@/lib/external-db';
// or
import { buyers, sellers, orders } from '@/lib/external-db';
```

### Fetch Buyers

```typescript
// Get all buyers
const allBuyers = await externalDb.buyers.getAllBuyers({ limit: 50 });

// Get buyer by ID
const buyer = await externalDb.buyers.getBuyerById('uuid-here');

// Search buyers
const results = await externalDb.buyers.searchBuyers('restaurant');

// Get buyers with credit limits
const creditBuyers = await externalDb.buyers.getBuyersWithCredit();
```

### Fetch Sellers

```typescript
// Get all sellers
const allSellers = await externalDb.sellers.getAllSellers();

// Get seller by ID
const seller = await externalDb.sellers.getSellerById('uuid-here');

// Search sellers
const results = await externalDb.sellers.searchSellers('food');

// Get top rated sellers
const topSellers = await externalDb.sellers.getTopRatedSellers(10);

// Get seller performance scores
const performance = await externalDb.sellers.getSellerPerformance('uuid');
```

### Fetch Orders & Payments

```typescript
// Get orders
const orders = await externalDb.orders.getOrders({
  buyerId: 'uuid',
  paymentStatus: 'pending',
});

// Get orders pending payment
const pendingOrders = await externalDb.orders.getPendingPaymentOrders();

// Get overdue payments
const overduePayments = await externalDb.orders.getOverduePayments();

// Get upcoming payments (next 7 days)
const upcomingPayments = await externalDb.orders.getUpcomingPayments(7);

// Get buyer order statistics
const stats = await externalDb.orders.getBuyerOrderStats('buyer-uuid');
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/external/test` | Test database connection |
| `GET /api/external/buyers` | List buyers |
| `GET /api/external/buyers/:id` | Get buyer by ID |
| `GET /api/external/sellers` | List sellers |
| `GET /api/external/sellers/:id` | Get seller by ID |
| `GET /api/external/orders` | List orders |
| `GET /api/external/orders/:id` | Get order by ID |
| `GET /api/external/payments` | Get payment milestones |

### Query Parameters

**Buyers:**
- `?search=term` - Search by name/email/phone
- `?withCredit=true` - Only buyers with credit limits
- `?limit=50&offset=0` - Pagination

**Sellers:**
- `?search=term` - Search by name/email/phone
- `?topRated=true` - Top rated sellers
- `?limit=50&offset=0` - Pagination

**Orders:**
- `?buyerId=uuid` - Filter by buyer
- `?sellerId=uuid` - Filter by seller
- `?paymentStatus=pending` - Filter by payment status
- `?pendingPayment=true` - Orders awaiting payment

**Payments:**
- `?overdue=true` - Overdue payments only
- `?upcoming=true&days=7` - Upcoming payments

## Data Types

### MappedBuyer

```typescript
interface MappedBuyer {
  externalId: string;      // UUID from Buyamia DB
  userId: string;          // User UUID
  name: string;            // Full name
  email: string | null;
  phone: string | null;
  businessName: string | null;
  status: string;
  creditLimit: number | null;
  allowedNetTerms: string[] | null;
  address: MappedAddress | null;
  createdAt: Date;
}
```

### MappedSeller

```typescript
interface MappedSeller {
  externalId: string;
  name: string;
  email: string;
  phone: string;
  businessType: string | null;
  status: string;
  rating: number | null;
  balance: number;
  taxNumber: string | null;
  registrationNumber: string | null;
  createdAt: Date;
}
```

### MappedOrder

```typescript
interface MappedOrder {
  externalId: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  status: string;
  total: number;
  currency: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
}
```

## Important Notes

1. **Read-Only**: This adapter only reads data. Never modify the external database.
2. **Soft Deletes**: All queries filter out `deleted_at IS NOT NULL` records.
3. **UUIDs**: All IDs from the external database are UUIDs, not your app's CUIDs.
4. **Connection Pool**: Uses a singleton pool with max 10 connections.
5. **Error Handling**: All methods throw on error - wrap in try/catch.

## Testing Connection

```bash
# Test the connection
curl http://localhost:3000/api/external/test

# Expected response:
{
  "success": true,
  "message": "External database connection successful",
  "status": "connected"
}
```



