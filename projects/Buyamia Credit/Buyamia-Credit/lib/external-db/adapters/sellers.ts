/**
 * Seller/Supplier Adapter
 * 
 * Fetches and maps seller data from the external Buyamia database
 */

import { query } from '../client';
import type { MappedSeller } from '../types';

/**
 * Get all sellers
 */
export async function getAllSellers(options?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<MappedSeller[]> {
  const { limit = 100, offset = 0, status } = options || {};

  const statusFilter = status ? 'AND s.status = $3' : '';
  const params: any[] = [limit, offset];
  if (status) params.push(status);

  const sql = `
    SELECT 
      s.id,
      s.name,
      s.email,
      s.primary_phone,
      s.business_type,
      s.status,
      s.rating,
      s.available_balance,
      s.pending_balance,
      s.tax_number,
      s.company_registration_number,
      s.is_onboarded,
      s.is_premium,
      s.created_at
    FROM public.sellers s
    WHERE s.deleted_at IS NULL
      ${statusFilter}
    ORDER BY s.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const rows = await query(sql, params);
  return rows.map(mapSellerRow);
}

/**
 * Get a single seller by their external ID
 */
export async function getSellerById(sellerId: string): Promise<MappedSeller | null> {
  const sql = `
    SELECT 
      s.id,
      s.name,
      s.email,
      s.primary_phone,
      s.business_type,
      s.status,
      s.rating,
      s.available_balance,
      s.pending_balance,
      s.tax_number,
      s.company_registration_number,
      s.is_onboarded,
      s.is_premium,
      s.created_at
    FROM public.sellers s
    WHERE s.id = $1
      AND s.deleted_at IS NULL
  `;

  const rows = await query(sql, [sellerId]);
  
  if (rows.length === 0) return null;
  return mapSellerRow(rows[0]);
}

/**
 * Get a seller by their email
 */
export async function getSellerByEmail(email: string): Promise<MappedSeller | null> {
  const sql = `
    SELECT 
      s.id,
      s.name,
      s.email,
      s.primary_phone,
      s.business_type,
      s.status,
      s.rating,
      s.available_balance,
      s.pending_balance,
      s.tax_number,
      s.company_registration_number,
      s.is_onboarded,
      s.is_premium,
      s.created_at
    FROM public.sellers s
    WHERE s.email = $1
      AND s.deleted_at IS NULL
  `;

  const rows = await query(sql, [email]);
  
  if (rows.length === 0) return null;
  return mapSellerRow(rows[0]);
}

/**
 * Get a seller by their phone number
 */
export async function getSellerByPhone(phoneNumber: string): Promise<MappedSeller | null> {
  const sql = `
    SELECT 
      s.id,
      s.name,
      s.email,
      s.primary_phone,
      s.business_type,
      s.status,
      s.rating,
      s.available_balance,
      s.pending_balance,
      s.tax_number,
      s.company_registration_number,
      s.is_onboarded,
      s.is_premium,
      s.created_at
    FROM public.sellers s
    WHERE s.primary_phone = $1
      AND s.deleted_at IS NULL
  `;

  const rows = await query(sql, [phoneNumber]);
  
  if (rows.length === 0) return null;
  return mapSellerRow(rows[0]);
}

/**
 * Search sellers by name
 */
export async function searchSellers(searchTerm: string, limit = 20): Promise<MappedSeller[]> {
  const sql = `
    SELECT 
      s.id,
      s.name,
      s.email,
      s.primary_phone,
      s.business_type,
      s.status,
      s.rating,
      s.available_balance,
      s.pending_balance,
      s.tax_number,
      s.company_registration_number,
      s.is_onboarded,
      s.is_premium,
      s.created_at
    FROM public.sellers s
    WHERE s.deleted_at IS NULL
      AND (
        LOWER(s.name) LIKE LOWER($1)
        OR LOWER(s.email) LIKE LOWER($1)
        OR s.primary_phone LIKE $1
      )
    ORDER BY s.name
    LIMIT $2
  `;

  const rows = await query(sql, [`%${searchTerm}%`, limit]);
  return rows.map(mapSellerRow);
}

/**
 * Get top rated sellers
 */
export async function getTopRatedSellers(limit = 20): Promise<MappedSeller[]> {
  const sql = `
    SELECT 
      s.id,
      s.name,
      s.email,
      s.primary_phone,
      s.business_type,
      s.status,
      s.rating,
      s.available_balance,
      s.pending_balance,
      s.tax_number,
      s.company_registration_number,
      s.is_onboarded,
      s.is_premium,
      s.created_at
    FROM public.sellers s
    WHERE s.deleted_at IS NULL
      AND s.status = 'active'
      AND s.rating IS NOT NULL
    ORDER BY s.rating DESC
    LIMIT $1
  `;

  const rows = await query(sql, [limit]);
  return rows.map(mapSellerRow);
}

/**
 * Get seller performance score
 */
export async function getSellerPerformance(sellerId: string): Promise<{
  category: string;
  score: number;
  explanation: string | null;
}[]> {
  const sql = `
    SELECT 
      category,
      score,
      explanation
    FROM public.seller_performance_scores
    WHERE supplier_id = $1
  `;

  const rows = await query(sql, [sellerId]);
  return rows.map(row => ({
    category: row.category,
    score: parseFloat(row.score),
    explanation: row.explanation,
  }));
}

/**
 * Map database row to MappedSeller
 */
function mapSellerRow(row: any): MappedSeller {
  return {
    externalId: row.id,
    name: row.name,
    email: row.email,
    phone: row.primary_phone,
    businessType: row.business_type,
    status: row.status,
    rating: row.rating ? parseFloat(row.rating) : null,
    balance: parseFloat(row.available_balance || 0),
    taxNumber: row.tax_number,
    registrationNumber: row.company_registration_number,
    createdAt: new Date(row.created_at),
  };
}



