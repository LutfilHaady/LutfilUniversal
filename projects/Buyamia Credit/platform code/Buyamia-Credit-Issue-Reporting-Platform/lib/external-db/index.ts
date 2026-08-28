/**
 * External Database Module
 * 
 * Provides read-only access to the main Buyamia database
 * for fetching buyer, seller, and order data.
 * 
 * @example
 * ```typescript
 * import { externalDb } from '@/lib/external-db';
 * 
 * // Get buyer info
 * const buyer = await externalDb.buyers.getBuyerById('uuid-here');
 * 
 * // Get seller info
 * const seller = await externalDb.sellers.getSellerById('uuid-here');
 * 
 * // Get orders
 * const orders = await externalDb.orders.getOrders({ buyerId: 'uuid' });
 * ```
 */

// Client
export { 
  query, 
  getClient, 
  closePool, 
  testConnection 
} from './client';

// Types
export type {
  ExternalUser,
  ExternalBuyer,
  ExternalSeller,
  ExternalAddress,
  ExternalBankAccount,
  ExternalOrganization,
  ExternalOrganizationDetails,
  ExternalOrder,
  ExternalQuote,
  ExternalQuoteMilestone,
  ExternalPurchaseOrder,
  MappedBuyer,
  MappedSeller,
  MappedAddress,
  MappedOrder,
  MappedPaymentMilestone,
} from './types';

// Adapters
import * as buyers from './adapters/buyers';
import * as sellers from './adapters/sellers';
import * as orders from './adapters/orders';

export const externalDb = {
  buyers,
  sellers,
  orders,
};

// Named exports for direct import
export { buyers, sellers, orders };



