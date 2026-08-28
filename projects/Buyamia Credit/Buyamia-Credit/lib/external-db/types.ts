/**
 * TypeScript types for the external Buyamia database
 * 
 * These types represent the structure of tables in the main Buyamia DB
 * Used for type-safe queries and data mapping
 */

// ============================================
// PUBLIC SCHEMA TYPES
// ============================================

/**
 * public.users table
 */
export interface ExternalUser {
  id: string; // UUID
  google_id: string | null;
  email: string | null;
  phone_number: string | null;
  password: string | null;
  first_name: string;
  last_name: string;
  status: string;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  profile_picture_id: string | null;
}

/**
 * public.buyers table
 */
export interface ExternalBuyer {
  id: string; // UUID
  user_id: string; // References users.id
  default_shipping_address_id: string | null;
  default_billing_address_id: string | null;
  default_bank_account_id: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * public.sellers table
 */
export interface ExternalSeller {
  id: string; // UUID
  name: string;
  slug: string;
  description: string | null;
  tag_line: string | null;
  available_balance: number;
  pending_balance: number;
  primary_phone: string;
  secondary_phone: string | null;
  email: string;
  company_type_id: string;
  default_bank_account_id: string | null;
  company_address_id: string | null;
  warehouse_address_id: string | null;
  status: string;
  rating: number | null;
  is_onboarded: boolean;
  is_premium: boolean;
  is_public: boolean;
  tax_number: string | null;
  company_registration_number: string | null;
  business_type: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * public.addresses table
 */
export interface ExternalAddress {
  id: string; // UUID
  user_id: string | null;
  recipient_name: string;
  primary_phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  country: string;
  zip_code: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * public.bank_accounts table
 */
export interface ExternalBankAccount {
  id: string; // UUID
  owner_id: string;
  bank_id: string;
  account_number: string;
  account_holder_name: string;
  is_default: boolean;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// ============================================
// PROCUREMENT SCHEMA TYPES
// ============================================

/**
 * procurement.organizations table
 */
export interface ExternalOrganization {
  id: string; // UUID
  owner_id: string;
  name: string;
  description: string | null;
  type: string | null;
  status: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * procurement.organization_details table
 */
export interface ExternalOrganizationDetails {
  id: string; // UUID
  organization_id: string;
  dba_name: string | null;
  legal_name: string | null;
  verification_status: string | null;
  business_type: string | null;
  industry: string | null;
  allowed_net_terms: any | null; // JSONB
  net_term_credit_limit: number | null;
  procurement_spend: number | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone_number: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * procurement.orders table
 */
export interface ExternalOrder {
  id: string; // UUID
  order_number: string;
  user_id: string;
  organization_id: string | null;
  partner_id: string;
  status: string;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  currency: string;
  payment_method: string | null;
  payment_status: string;
  paid_at: Date | null;
  shipped_at: Date | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * procurement.quotes table
 */
export interface ExternalQuote {
  id: string; // UUID
  request_id: string;
  supplier_id: string;
  supplier_type: string;
  initial_total_amount: number;
  current_total_amount: number;
  status: string;
  negotiation_status: string;
  payment_type: string;
  payment_days: number | null;
  credit_term_days: number | null;
  paid_amount: number | null;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * procurement.quote_milestones table
 */
export interface ExternalQuoteMilestone {
  id: string; // UUID
  quote_id: string;
  milestone_name: string;
  description: string | null;
  percentage: number;
  amount: number;
  status: string;
  due_date: Date | null;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * procurement.purchase_orders table
 */
export interface ExternalPurchaseOrder {
  id: string; // UUID
  po_number: string;
  request_id: string;
  quote_id: string;
  status: string;
  total_amount: number | null;
  confirmed_at: Date | null;
  expected_delivery_date: Date | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// ============================================
// MAPPED TYPES (For your app's use)
// ============================================

/**
 * Buyer info mapped for Credit Platform
 */
export interface MappedBuyer {
  externalId: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  status: string;
  creditLimit: number | null;
  allowedNetTerms: string[] | null;
  address: MappedAddress | null;
  createdAt: Date;
}

/**
 * Seller/Supplier info mapped for Credit Platform
 */
export interface MappedSeller {
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

/**
 * Address mapped for Credit Platform
 */
export interface MappedAddress {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  country: string;
  zipCode: string;
}

/**
 * Order/Invoice mapped for Credit Platform
 */
export interface MappedOrder {
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

/**
 * Payment milestone mapped for Credit Platform
 */
export interface MappedPaymentMilestone {
  externalId: string;
  quoteId: string;
  name: string;
  percentage: number;
  amount: number;
  status: string;
  dueDate: Date | null;
  paidAt: Date | null;
}



