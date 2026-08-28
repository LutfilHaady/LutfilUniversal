/**
 * Buyer Adapter
 * 
 * Fetches and maps buyer data from the external Buyamia database
 */

import { query } from '../client';
import type { 
  ExternalBuyer, 
  ExternalUser, 
  ExternalAddress,
  ExternalOrganizationDetails,
  MappedBuyer, 
  MappedAddress 
} from '../types';

/**
 * Get all buyers with their user info and credit details
 */
export async function getAllBuyers(options?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<MappedBuyer[]> {
  const { limit = 100, offset = 0, status } = options || {};

  const statusFilter = status ? 'AND b.status = $3' : '';
  const params: any[] = [limit, offset];
  if (status) params.push(status);

  const sql = `
    SELECT 
      b.id as buyer_id,
      b.user_id,
      b.status as buyer_status,
      b.created_at,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      od.net_term_credit_limit,
      od.allowed_net_terms,
      o.name as org_name,
      a.recipient_name,
      a.primary_phone as address_phone,
      a.address_line_1,
      a.address_line_2,
      a.city,
      a.state,
      a.country,
      a.zip_code
    FROM public.buyers b
    JOIN public.users u ON b.user_id = u.id
    LEFT JOIN procurement.organization_members om ON u.id = om.user_id AND om.deleted_at IS NULL
    LEFT JOIN procurement.organizations o ON om.organization_id = o.id AND o.deleted_at IS NULL
    LEFT JOIN procurement.organization_details od ON o.id = od.organization_id AND od.deleted_at IS NULL
    LEFT JOIN public.addresses a ON b.default_shipping_address_id = a.id AND a.deleted_at IS NULL
    WHERE b.deleted_at IS NULL 
      AND u.deleted_at IS NULL
      ${statusFilter}
    ORDER BY b.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const rows = await query(sql, params);

  return rows.map(mapBuyerRow);
}

/**
 * Get a single buyer by their external ID
 */
export async function getBuyerById(buyerId: string): Promise<MappedBuyer | null> {
  const sql = `
    SELECT 
      b.id as buyer_id,
      b.user_id,
      b.status as buyer_status,
      b.created_at,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      od.net_term_credit_limit,
      od.allowed_net_terms,
      o.name as org_name,
      a.recipient_name,
      a.primary_phone as address_phone,
      a.address_line_1,
      a.address_line_2,
      a.city,
      a.state,
      a.country,
      a.zip_code
    FROM public.buyers b
    JOIN public.users u ON b.user_id = u.id
    LEFT JOIN procurement.organization_members om ON u.id = om.user_id AND om.deleted_at IS NULL
    LEFT JOIN procurement.organizations o ON om.organization_id = o.id AND o.deleted_at IS NULL
    LEFT JOIN procurement.organization_details od ON o.id = od.organization_id AND od.deleted_at IS NULL
    LEFT JOIN public.addresses a ON b.default_shipping_address_id = a.id AND a.deleted_at IS NULL
    WHERE b.id = $1
      AND b.deleted_at IS NULL 
      AND u.deleted_at IS NULL
  `;

  const rows = await query(sql, [buyerId]);
  
  if (rows.length === 0) return null;
  return mapBuyerRow(rows[0]);
}

/**
 * Get a buyer by their phone number
 */
export async function getBuyerByPhone(phoneNumber: string): Promise<MappedBuyer | null> {
  const sql = `
    SELECT 
      b.id as buyer_id,
      b.user_id,
      b.status as buyer_status,
      b.created_at,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      od.net_term_credit_limit,
      od.allowed_net_terms,
      o.name as org_name,
      a.recipient_name,
      a.primary_phone as address_phone,
      a.address_line_1,
      a.address_line_2,
      a.city,
      a.state,
      a.country,
      a.zip_code
    FROM public.buyers b
    JOIN public.users u ON b.user_id = u.id
    LEFT JOIN procurement.organization_members om ON u.id = om.user_id AND om.deleted_at IS NULL
    LEFT JOIN procurement.organizations o ON om.organization_id = o.id AND o.deleted_at IS NULL
    LEFT JOIN procurement.organization_details od ON o.id = od.organization_id AND od.deleted_at IS NULL
    LEFT JOIN public.addresses a ON b.default_shipping_address_id = a.id AND a.deleted_at IS NULL
    WHERE u.phone_number = $1
      AND b.deleted_at IS NULL 
      AND u.deleted_at IS NULL
  `;

  const rows = await query(sql, [phoneNumber]);
  
  if (rows.length === 0) return null;
  return mapBuyerRow(rows[0]);
}

/**
 * Get a buyer by their email
 */
export async function getBuyerByEmail(email: string): Promise<MappedBuyer | null> {
  const sql = `
    SELECT 
      b.id as buyer_id,
      b.user_id,
      b.status as buyer_status,
      b.created_at,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      od.net_term_credit_limit,
      od.allowed_net_terms,
      o.name as org_name,
      a.recipient_name,
      a.primary_phone as address_phone,
      a.address_line_1,
      a.address_line_2,
      a.city,
      a.state,
      a.country,
      a.zip_code
    FROM public.buyers b
    JOIN public.users u ON b.user_id = u.id
    LEFT JOIN procurement.organization_members om ON u.id = om.user_id AND om.deleted_at IS NULL
    LEFT JOIN procurement.organizations o ON om.organization_id = o.id AND o.deleted_at IS NULL
    LEFT JOIN procurement.organization_details od ON o.id = od.organization_id AND od.deleted_at IS NULL
    LEFT JOIN public.addresses a ON b.default_shipping_address_id = a.id AND a.deleted_at IS NULL
    WHERE u.email = $1
      AND b.deleted_at IS NULL 
      AND u.deleted_at IS NULL
  `;

  const rows = await query(sql, [email]);
  
  if (rows.length === 0) return null;
  return mapBuyerRow(rows[0]);
}

/**
 * Search buyers by name or business name
 */
export async function searchBuyers(searchTerm: string, limit = 20): Promise<MappedBuyer[]> {
  const sql = `
    SELECT 
      b.id as buyer_id,
      b.user_id,
      b.status as buyer_status,
      b.created_at,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      od.net_term_credit_limit,
      od.allowed_net_terms,
      o.name as org_name,
      a.recipient_name,
      a.primary_phone as address_phone,
      a.address_line_1,
      a.address_line_2,
      a.city,
      a.state,
      a.country,
      a.zip_code
    FROM public.buyers b
    JOIN public.users u ON b.user_id = u.id
    LEFT JOIN procurement.organization_members om ON u.id = om.user_id AND om.deleted_at IS NULL
    LEFT JOIN procurement.organizations o ON om.organization_id = o.id AND o.deleted_at IS NULL
    LEFT JOIN procurement.organization_details od ON o.id = od.organization_id AND od.deleted_at IS NULL
    LEFT JOIN public.addresses a ON b.default_shipping_address_id = a.id AND a.deleted_at IS NULL
    WHERE b.deleted_at IS NULL 
      AND u.deleted_at IS NULL
      AND (
        LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($1)
        OR LOWER(o.name) LIKE LOWER($1)
        OR u.email LIKE LOWER($1)
        OR u.phone_number LIKE $1
      )
    ORDER BY u.first_name, u.last_name
    LIMIT $2
  `;

  const rows = await query(sql, [`%${searchTerm}%`, limit]);
  return rows.map(mapBuyerRow);
}

/**
 * Get buyers with credit limits
 */
export async function getBuyersWithCredit(limit = 50): Promise<MappedBuyer[]> {
  const sql = `
    SELECT 
      b.id as buyer_id,
      b.user_id,
      b.status as buyer_status,
      b.created_at,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      od.net_term_credit_limit,
      od.allowed_net_terms,
      o.name as org_name,
      a.recipient_name,
      a.primary_phone as address_phone,
      a.address_line_1,
      a.address_line_2,
      a.city,
      a.state,
      a.country,
      a.zip_code
    FROM public.buyers b
    JOIN public.users u ON b.user_id = u.id
    LEFT JOIN procurement.organization_members om ON u.id = om.user_id AND om.deleted_at IS NULL
    LEFT JOIN procurement.organizations o ON om.organization_id = o.id AND o.deleted_at IS NULL
    LEFT JOIN procurement.organization_details od ON o.id = od.organization_id AND od.deleted_at IS NULL
    LEFT JOIN public.addresses a ON b.default_shipping_address_id = a.id AND a.deleted_at IS NULL
    WHERE b.deleted_at IS NULL 
      AND u.deleted_at IS NULL
      AND od.net_term_credit_limit IS NOT NULL
      AND od.net_term_credit_limit > 0
    ORDER BY od.net_term_credit_limit DESC
    LIMIT $1
  `;

  const rows = await query(sql, [limit]);
  return rows.map(mapBuyerRow);
}

/**
 * Map database row to MappedBuyer
 */
function mapBuyerRow(row: any): MappedBuyer {
  const address: MappedAddress | null = row.address_line_1 ? {
    recipientName: row.recipient_name || '',
    phone: row.address_phone || '',
    line1: row.address_line_1,
    line2: row.address_line_2,
    city: row.city || '',
    state: row.state || '',
    country: row.country || '',
    zipCode: row.zip_code || '',
  } : null;

  return {
    externalId: row.buyer_id,
    userId: row.user_id,
    name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    email: row.email,
    phone: row.phone_number,
    businessName: row.org_name,
    status: row.buyer_status,
    creditLimit: row.net_term_credit_limit ? parseFloat(row.net_term_credit_limit) : null,
    allowedNetTerms: row.allowed_net_terms,
    address,
    createdAt: new Date(row.created_at),
  };
}



