# Database Mapping for Buyamia Credit Platform

This document maps the existing Buyamia database tables to the Credit Platform's data needs.

---

## 🔗 Connection Details
- **Host:** `postgres16-rw.dlt.buyamia.com`
- **Database:** `buyamia_dlt_dev`
- **Schemas:** `public`, `procurement`

---

## 📊 Available Data for Credit Platform

### 1. BUYERS (Customers who need credit)

**Table:** `public.buyers`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Links to users table |
| `default_shipping_address_id` | uuid | Default shipping address |
| `default_billing_address_id` | uuid | Default billing address |
| `default_bank_account_id` | uuid | Bank account for payments |
| `status` | varchar | Account status |
| `created_at` | timestamp | Registration date |

**Related:** `public.users` for contact info (email, phone, name)

---

### 2. SELLERS/SUPPLIERS (Vendors extending credit)

**Table:** `public.sellers`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | varchar | Business name |
| `slug` | varchar | URL-friendly name |
| `description` | text | Business description |
| `available_balance` | numeric | Current balance |
| `pending_balance` | numeric | Pending amounts |
| `primary_phone` | varchar | Contact phone |
| `email` | varchar | Business email |
| `company_type_id` | uuid | Type of company |
| `default_bank_account_id` | uuid | Payment account |
| `status` | varchar | Active/inactive |
| `rating` | numeric | Seller rating |
| `is_onboarded` | boolean | Onboarding complete |
| `tax_number` | text | Tax ID |
| `company_registration_number` | text | Business registration |
| `business_type` | varchar | Type of business |

---

### 3. USERS (Contact information)

**Table:** `public.users`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `email` | varchar | Email address |
| `phone_number` | varchar | Phone number |
| `first_name` | varchar | First name |
| `last_name` | varchar | Last name |
| `status` | varchar | Account status |
| `is_verified` | boolean | Email/phone verified |

---

### 4. ORDERS & INVOICES

**Table:** `procurement.orders`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `order_number` | varchar | Unique order number |
| `user_id` | uuid | Buyer user ID |
| `organization_id` | uuid | Buyer organization |
| `partner_id` | uuid | Seller partner ID |
| `status` | varchar | Order status |
| `subtotal` | numeric | Pre-tax amount |
| `shipping_cost` | numeric | Delivery cost |
| `tax` | numeric | Tax amount |
| `total` | numeric | **Total amount due** |
| `currency` | varchar | Currency code |
| `payment_method` | varchar | How they'll pay |
| `payment_status` | varchar | **paid/pending/overdue** |
| `paid_at` | timestamp | When payment received |
| `shipped_at` | timestamp | Ship date |
| `delivered_at` | timestamp | Delivery date |
| `cancelled_at` | timestamp | If cancelled |

**Table:** `procurement.purchase_orders`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `po_number` | varchar | PO number |
| `request_id` | uuid | Source request |
| `quote_id` | uuid | Accepted quote |
| `status` | varchar | PO status |
| `total_amount` | numeric | Total value |
| `confirmed_at` | timestamp | Confirmation date |
| `expected_delivery_date` | timestamp | Expected delivery |
| `payment_terms` | varchar | **Net 30, etc.** |

---

### 5. QUOTES & PRICING (Credit terms offered)

**Table:** `procurement.quotes`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `request_id` | uuid | Request reference |
| `supplier_id` | uuid | Seller ID |
| `initial_total_amount` | numeric | Original quote |
| `current_total_amount` | numeric | Final amount |
| `status` | varchar | Quote status |
| `payment_type` | varchar | Payment type |
| `payment_days` | integer | **Days to pay (Net terms)** |
| `credit_term_days` | integer | **Credit terms in days** |
| `paid_amount` | numeric | Amount paid so far |
| `paid_at` | timestamp | Payment date |

**Table:** `procurement.quote_milestones` (Payment schedules)
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `quote_id` | uuid | Quote reference |
| `milestone_name` | varchar | "Deposit", "Final", etc. |
| `percentage` | integer | % of total |
| `amount` | numeric | Amount due |
| `status` | varchar | paid/pending |
| `due_date` | timestamp | **Payment due date** |
| `paid_at` | timestamp | Actual payment date |

---

### 6. PRICING CONTRACTS (Pre-agreed credit terms)

**Table:** `procurement.pricing_contracts`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `contract_number` | varchar | Contract reference |
| `buyer_id` | uuid | Buyer reference |
| `partner_id` | uuid | Seller reference |
| `organization_id` | uuid | Buyer org |
| `status` | varchar | Contract status |
| `start_date` | date | Effective from |
| `end_date` | date | Expires on |

---

### 7. ORGANIZATIONS (Buyer companies)

**Table:** `procurement.organizations`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `owner_id` | uuid | Owner user |
| `name` | varchar | Company name |
| `type` | varchar | Business type |
| `status` | varchar | Active status |

**Table:** `procurement.organization_details`
| Column | Type | Description |
|--------|------|-------------|
| `organization_id` | uuid | Org reference |
| `dba_name` | varchar | Doing business as |
| `legal_name` | varchar | Legal entity name |
| `verification_status` | varchar | KYC status |
| `business_type` | varchar | Type of business |
| `industry` | varchar | Industry sector |
| `allowed_net_terms` | jsonb | **Approved credit terms** |
| `net_term_credit_limit` | numeric | **Credit limit amount** |
| `procurement_spend` | numeric | Historical spend |
| `owner_name` | varchar | Owner name |
| `owner_email` | varchar | Owner email |
| `owner_phone_number` | varchar | Owner phone |

---

### 8. ADDRESSES

**Table:** `public.addresses`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | User reference |
| `recipient_name` | varchar | Recipient |
| `primary_phone` | varchar | Phone |
| `address_line_1` | varchar | Street address |
| `city` | varchar | City |
| `state` | varchar | Province/State |
| `country` | varchar | Country |
| `zip_code` | varchar | Postal code |

---

### 9. BANK ACCOUNTS

**Table:** `public.bank_accounts`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `owner_id` | uuid | Owner reference |
| `bank_id` | uuid | Bank reference |
| `account_number` | varchar | Account number |
| `account_holder_name` | varchar | Account holder |
| `is_default` | boolean | Primary account |
| `status` | varchar | Active status |

---

### 10. WHATSAPP MESSAGES (For collections)

**Table:** `public.whatsapp_message_logs`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `template_id` | varchar | Message template |
| `from_number` | varchar | Sender number |
| `to_number` | varchar | Recipient number |
| `status` | varchar | Delivery status |
| `message_body` | text | Message content |
| `user_id` | uuid | User reference |

---

### 11. SELLER PERFORMANCE (For credit scoring)

**Table:** `public.seller_performance_scores`
| Column | Type | Description |
|--------|------|-------------|
| `supplier_id` | uuid | Seller reference |
| `category` | text | Score category |
| `score` | numeric | Performance score |
| `explanation` | text | Score reasoning |
| `details` | jsonb | Detailed metrics |

**Table:** `public.seller_balance_logs`
| Column | Type | Description |
|--------|------|-------------|
| `seller_id` | uuid | Seller reference |
| `amount` | numeric | Transaction amount |
| `status` | varchar | Transaction status |
| `description` | text | Description |

---

## 🔄 Variable Mapping: Your Schema → Database

| Your Platform Variable | Database Table.Column |
|------------------------|----------------------|
| `buyerId` | `public.buyers.id` |
| `buyerName` | `public.users.first_name + last_name` |
| `buyerPhone` | `public.users.phone_number` |
| `buyerEmail` | `public.users.email` |
| `supplierId` | `public.sellers.id` |
| `supplierName` | `public.sellers.name` |
| `supplierPhone` | `public.sellers.primary_phone` |
| `invoiceAmount` | `procurement.quotes.current_total_amount` |
| `dueDate` | `procurement.quote_milestones.due_date` |
| `paymentTerms` | `procurement.quotes.credit_term_days` |
| `creditLimit` | `procurement.organization_details.net_term_credit_limit` |
| `orderNumber` | `procurement.orders.order_number` |
| `orderTotal` | `procurement.orders.total` |
| `paymentStatus` | `procurement.orders.payment_status` |
| `businessName` | `public.sellers.name` / `procurement.organizations.name` |
| `businessType` | `public.sellers.business_type` |
| `address` | `public.addresses.*` |

---

## ⚠️ Important Notes

1. **Read-Only Access** - Do not modify these tables, only query them
2. **UUID Keys** - All IDs are UUIDs, not sequential integers
3. **Soft Deletes** - Check `deleted_at IS NULL` in queries
4. **Timestamps** - All timestamps are `timestamp with time zone`
5. **Multi-Schema** - Data spans `public` and `procurement` schemas

---

## 📝 Example Queries

### Get buyer with credit info:
```sql
SELECT 
  b.id as buyer_id,
  u.first_name || ' ' || u.last_name as buyer_name,
  u.email,
  u.phone_number,
  od.net_term_credit_limit as credit_limit,
  od.allowed_net_terms
FROM public.buyers b
JOIN public.users u ON b.user_id = u.id
LEFT JOIN procurement.organization_members om ON u.id = om.user_id
LEFT JOIN procurement.organization_details od ON om.organization_id = od.organization_id
WHERE b.deleted_at IS NULL;
```

### Get outstanding payments:
```sql
SELECT 
  q.id as quote_id,
  q.current_total_amount,
  q.paid_amount,
  q.credit_term_days,
  qm.due_date,
  qm.status as payment_status
FROM procurement.quotes q
JOIN procurement.quote_milestones qm ON q.id = qm.quote_id
WHERE qm.status != 'paid'
  AND qm.deleted_at IS NULL;
```

### Get seller info:
```sql
SELECT 
  s.id,
  s.name,
  s.email,
  s.primary_phone,
  s.available_balance,
  s.status
FROM public.sellers s
WHERE s.deleted_at IS NULL;
```
