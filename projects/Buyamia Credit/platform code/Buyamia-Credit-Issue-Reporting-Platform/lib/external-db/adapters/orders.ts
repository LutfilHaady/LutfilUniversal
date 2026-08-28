/**
 * Orders Adapter
 * 
 * Fetches and maps order/payment data from the external Buyamia database
 */

import { query } from '../client';
import type { MappedOrder, MappedPaymentMilestone } from '../types';

/**
 * Get orders with optional filters
 */
export async function getOrders(options?: {
  limit?: number;
  offset?: number;
  buyerId?: string;
  sellerId?: string;
  status?: string;
  paymentStatus?: string;
}): Promise<MappedOrder[]> {
  const { limit = 100, offset = 0, buyerId, sellerId, status, paymentStatus } = options || {};

  const conditions: string[] = ['o.deleted_at IS NULL'];
  const params: any[] = [];
  let paramIndex = 1;

  if (buyerId) {
    conditions.push(`o.user_id = $${paramIndex++}`);
    params.push(buyerId);
  }
  if (sellerId) {
    conditions.push(`o.partner_id = $${paramIndex++}`);
    params.push(sellerId);
  }
  if (status) {
    conditions.push(`o.status = $${paramIndex++}`);
    params.push(status);
  }
  if (paymentStatus) {
    conditions.push(`o.payment_status = $${paramIndex++}`);
    params.push(paymentStatus);
  }

  params.push(limit, offset);

  const sql = `
    SELECT 
      o.id,
      o.order_number,
      o.user_id,
      o.partner_id,
      o.status,
      o.subtotal,
      o.shipping_cost,
      o.tax,
      o.total,
      o.currency,
      o.payment_method,
      o.payment_status,
      o.paid_at,
      o.shipped_at,
      o.delivered_at,
      o.created_at
    FROM procurement.orders o
    WHERE ${conditions.join(' AND ')}
    ORDER BY o.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  const rows = await query(sql, params);
  return rows.map(mapOrderRow);
}

/**
 * Get a single order by ID
 */
export async function getOrderById(orderId: string): Promise<MappedOrder | null> {
  const sql = `
    SELECT 
      o.id,
      o.order_number,
      o.user_id,
      o.partner_id,
      o.status,
      o.subtotal,
      o.shipping_cost,
      o.tax,
      o.total,
      o.currency,
      o.payment_method,
      o.payment_status,
      o.paid_at,
      o.shipped_at,
      o.delivered_at,
      o.created_at
    FROM procurement.orders o
    WHERE o.id = $1
      AND o.deleted_at IS NULL
  `;

  const rows = await query(sql, [orderId]);
  
  if (rows.length === 0) return null;
  return mapOrderRow(rows[0]);
}

/**
 * Get order by order number
 */
export async function getOrderByNumber(orderNumber: string): Promise<MappedOrder | null> {
  const sql = `
    SELECT 
      o.id,
      o.order_number,
      o.user_id,
      o.partner_id,
      o.status,
      o.subtotal,
      o.shipping_cost,
      o.tax,
      o.total,
      o.currency,
      o.payment_method,
      o.payment_status,
      o.paid_at,
      o.shipped_at,
      o.delivered_at,
      o.created_at
    FROM procurement.orders o
    WHERE o.order_number = $1
      AND o.deleted_at IS NULL
  `;

  const rows = await query(sql, [orderNumber]);
  
  if (rows.length === 0) return null;
  return mapOrderRow(rows[0]);
}

/**
 * Get orders pending payment (for collections)
 */
export async function getPendingPaymentOrders(limit = 50): Promise<MappedOrder[]> {
  const sql = `
    SELECT 
      o.id,
      o.order_number,
      o.user_id,
      o.partner_id,
      o.status,
      o.subtotal,
      o.shipping_cost,
      o.tax,
      o.total,
      o.currency,
      o.payment_method,
      o.payment_status,
      o.paid_at,
      o.shipped_at,
      o.delivered_at,
      o.created_at
    FROM procurement.orders o
    WHERE o.deleted_at IS NULL
      AND o.payment_status IN ('pending', 'unpaid', 'partial')
      AND o.status NOT IN ('cancelled', 'refunded')
    ORDER BY o.created_at ASC
    LIMIT $1
  `;

  const rows = await query(sql, [limit]);
  return rows.map(mapOrderRow);
}

/**
 * Get overdue payment milestones
 */
export async function getOverduePayments(limit = 50): Promise<MappedPaymentMilestone[]> {
  const sql = `
    SELECT 
      qm.id,
      qm.quote_id,
      qm.milestone_name,
      qm.percentage,
      qm.amount,
      qm.status,
      qm.due_date,
      qm.paid_at
    FROM procurement.quote_milestones qm
    JOIN procurement.quotes q ON qm.quote_id = q.id
    WHERE qm.deleted_at IS NULL
      AND q.deleted_at IS NULL
      AND qm.status != 'paid'
      AND qm.due_date < NOW()
    ORDER BY qm.due_date ASC
    LIMIT $1
  `;

  const rows = await query(sql, [limit]);
  return rows.map(mapMilestoneRow);
}

/**
 * Get upcoming payment milestones (due within N days)
 */
export async function getUpcomingPayments(daysAhead = 7, limit = 50): Promise<MappedPaymentMilestone[]> {
  const sql = `
    SELECT 
      qm.id,
      qm.quote_id,
      qm.milestone_name,
      qm.percentage,
      qm.amount,
      qm.status,
      qm.due_date,
      qm.paid_at
    FROM procurement.quote_milestones qm
    JOIN procurement.quotes q ON qm.quote_id = q.id
    WHERE qm.deleted_at IS NULL
      AND q.deleted_at IS NULL
      AND qm.status != 'paid'
      AND qm.due_date >= NOW()
      AND qm.due_date <= NOW() + INTERVAL '${daysAhead} days'
    ORDER BY qm.due_date ASC
    LIMIT $1
  `;

  const rows = await query(sql, [limit]);
  return rows.map(mapMilestoneRow);
}

/**
 * Get payment milestones for a quote
 */
export async function getQuoteMilestones(quoteId: string): Promise<MappedPaymentMilestone[]> {
  const sql = `
    SELECT 
      qm.id,
      qm.quote_id,
      qm.milestone_name,
      qm.percentage,
      qm.amount,
      qm.status,
      qm.due_date,
      qm.paid_at
    FROM procurement.quote_milestones qm
    WHERE qm.quote_id = $1
      AND qm.deleted_at IS NULL
    ORDER BY qm.due_date ASC
  `;

  const rows = await query(sql, [quoteId]);
  return rows.map(mapMilestoneRow);
}

/**
 * Get quote details
 */
export async function getQuoteById(quoteId: string): Promise<{
  id: string;
  supplierId: string;
  totalAmount: number;
  paidAmount: number | null;
  creditTermDays: number | null;
  status: string;
  paymentType: string;
} | null> {
  const sql = `
    SELECT 
      q.id,
      q.supplier_id,
      q.current_total_amount,
      q.paid_amount,
      q.credit_term_days,
      q.status,
      q.payment_type
    FROM procurement.quotes q
    WHERE q.id = $1
      AND q.deleted_at IS NULL
  `;

  const rows = await query(sql, [quoteId]);
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  return {
    id: row.id,
    supplierId: row.supplier_id,
    totalAmount: parseFloat(row.current_total_amount),
    paidAmount: row.paid_amount ? parseFloat(row.paid_amount) : null,
    creditTermDays: row.credit_term_days,
    status: row.status,
    paymentType: row.payment_type,
  };
}

/**
 * Get purchase orders for a buyer
 */
export async function getPurchaseOrders(options?: {
  buyerId?: string;
  sellerId?: string;
  status?: string;
  limit?: number;
}): Promise<{
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number | null;
  paymentTerms: string | null;
  expectedDeliveryDate: Date | null;
  createdAt: Date;
}[]> {
  const { buyerId, sellerId, status, limit = 50 } = options || {};
  
  const conditions: string[] = ['po.deleted_at IS NULL'];
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`po.status = $${paramIndex++}`);
    params.push(status);
  }

  params.push(limit);

  const sql = `
    SELECT 
      po.id,
      po.po_number,
      po.status,
      po.total_amount,
      po.payment_terms,
      po.expected_delivery_date,
      po.created_at
    FROM procurement.purchase_orders po
    WHERE ${conditions.join(' AND ')}
    ORDER BY po.created_at DESC
    LIMIT $${paramIndex}
  `;

  const rows = await query(sql, params);
  return rows.map(row => ({
    id: row.id,
    poNumber: row.po_number,
    status: row.status,
    totalAmount: row.total_amount ? parseFloat(row.total_amount) : null,
    paymentTerms: row.payment_terms,
    expectedDeliveryDate: row.expected_delivery_date ? new Date(row.expected_delivery_date) : null,
    createdAt: new Date(row.created_at),
  }));
}

/**
 * Get order statistics for a buyer
 */
export async function getBuyerOrderStats(buyerId: string): Promise<{
  totalOrders: number;
  totalSpent: number;
  pendingPayments: number;
  paidOrders: number;
}> {
  const sql = `
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total), 0) as total_spent,
      COUNT(*) FILTER (WHERE payment_status IN ('pending', 'unpaid', 'partial')) as pending_payments,
      COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_orders
    FROM procurement.orders
    WHERE user_id = $1
      AND deleted_at IS NULL
      AND status != 'cancelled'
  `;

  const rows = await query(sql, [buyerId]);
  const row = rows[0];
  
  return {
    totalOrders: parseInt(row.total_orders),
    totalSpent: parseFloat(row.total_spent),
    pendingPayments: parseInt(row.pending_payments),
    paidOrders: parseInt(row.paid_orders),
  };
}

/**
 * Map database row to MappedOrder
 */
function mapOrderRow(row: any): MappedOrder {
  return {
    externalId: row.id,
    orderNumber: row.order_number,
    buyerId: row.user_id,
    sellerId: row.partner_id,
    status: row.status,
    total: parseFloat(row.total),
    currency: row.currency,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    paidAt: row.paid_at ? new Date(row.paid_at) : null,
    shippedAt: row.shipped_at ? new Date(row.shipped_at) : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : null,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Map database row to MappedPaymentMilestone
 */
function mapMilestoneRow(row: any): MappedPaymentMilestone {
  return {
    externalId: row.id,
    quoteId: row.quote_id,
    name: row.milestone_name,
    percentage: parseInt(row.percentage),
    amount: parseFloat(row.amount),
    status: row.status,
    dueDate: row.due_date ? new Date(row.due_date) : null,
    paidAt: row.paid_at ? new Date(row.paid_at) : null,
  };
}



