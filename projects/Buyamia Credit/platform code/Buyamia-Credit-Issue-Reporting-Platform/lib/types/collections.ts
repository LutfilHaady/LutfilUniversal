/**
 * Collections Agent Type Definitions
 * 
 * These types match the backend API response structure.
 * When backend is ready, these will be used for type safety.
 */

export enum CallStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NO_ANSWER = 'NO_ANSWER',
  BUSY = 'BUSY',
}

export enum CallDirection {
  OUTBOUND = 'OUTBOUND',
  INBOUND = 'INBOUND',
}

export enum ToneLevel {
  FRIENDLY = 'friendly',
  PROFESSIONAL = 'professional',
  URGENT = 'urgent',
  FIRM = 'firm',
  ESCALATED = 'escalated',
}

export enum CollectionAttemptType {
  WHATSAPP_MESSAGE = 'whatsapp_message',
  WHATSAPP_CALL = 'whatsapp_call',
}

export enum CollectionAttemptStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  ANSWERED = 'answered',
  NO_ANSWER = 'no_answer',
  BUSY = 'busy',
  PENDING = 'pending',
}

export enum CollectionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  PAID = 'paid',
  ESCALATED = 'escalated',
}

/**
 * Call record - represents a WhatsApp call made to buyer
 */
export interface Call {
  id: string
  invoiceId: string
  buyerId: string
  supplierId: string
  direction: CallDirection
  status: CallStatus
  toneLevel: ToneLevel
  callSid?: string // Twilio WhatsApp Call SID
  duration?: number // Duration in seconds
  recordingUrl?: string // Twilio recording URL (WhatsApp call)
  transcript?: string // AI transcription of WhatsApp call
  aiResponse?: string // AI-generated conversation script for WhatsApp call
  startedAt?: string // ISO date string
  endedAt?: string // ISO date string
  createdAt: string // ISO date string
}

/**
 * Collection attempt - represents a single collection action (WhatsApp Message or WhatsApp Call)
 */
export interface CollectionAttempt {
  id: string
  invoiceId: string
  attemptType: CollectionAttemptType // WHATSAPP_MESSAGE or WHATSAPP_CALL
  toneLevel: ToneLevel
  status: CollectionAttemptStatus
  messageId?: string // WhatsApp message ID (if WhatsApp message)
  messageContent?: string // The actual message content that was sent (if WhatsApp message)
  callId?: string // Call ID (if WhatsApp call)
  response?: string // Buyer response (if any)
  createdAt: string // ISO date string
  
  // Relations (populated by backend)
  call?: Call // Only populated if attemptType is WHATSAPP_CALL
  invoice?: {
    invoiceNumber: string
    amount: number
    dueDate: string
    buyer?: {
      userId: string
      businessName: string
      phoneNumber: string
    }
  }
}

/**
 * Invoice with collection information
 */
export interface InvoiceWithCollections {
  id: string
  invoiceNumber: string
  buyerId: string
  supplierId: string
  amount: number
  dueDate: string
  status: string
  lastCollectionAttempt?: string // ISO date string
  collectionStatus?: CollectionStatus
  collectionAttempts?: CollectionAttempt[]
  daysOverdue?: number
  daysUntilDue?: number
}

/**
 * Collection statistics for supplier dashboard
 */
export interface CollectionStats {
  totalAttempts: number
  activeCollections: number
  responseRate: number // Percentage
  paymentRate: number // Percentage after collection
  averageTimeToPayment: number // Days
  totalOutstanding: number
  buyersNotResponding: number
}

/**
 * Cross-supplier payment history (for Search page)
 */
export interface CrossSupplierPaymentHistory {
  totalInvoices: number
  paidInvoices: number
  overdueInvoices: number
  totalOutstanding: number // Across all suppliers
  suppliersCount: number // Number of suppliers buyer owes
  lastPaymentDate?: string // ISO date string
  averagePaymentDelay: number // Days
  nonPaymentReports: number // Suppliers reporting non-payment
  collectionAttemptsCount: number // Total collection attempts across suppliers
}

/**
 * Collection context for AI agent
 * 
 * IMPORTANT: Phone Number Retrieval
 * - Phone numbers are stored in User model as `phoneNumber` field (formatted: "+62 XXX-XXXX-XXXX")
 * - When creating collection attempts, retrieve phone number from: invoice.buyer.phoneNumber
 * - Use normalizePhoneForTwilio() utility to convert to E.164 format for Twilio API
 * - Example backend query:
 *   const invoice = await prisma.invoice.findUnique({
 *     where: { id: invoiceId },
 *     include: { buyer: true }
 *   })
 *   const buyerPhone = normalizePhoneForTwilio(invoice.buyer.phoneNumber)
 */
export interface CollectionContext {
  invoiceId: string
  invoiceNumber: string
  buyerName: string
  buyerPhone: string // Should be in E.164 format (e.g., "+6281234567890") for Twilio API
  amount: number
  dueDate: string
  daysOverdue: number
  paymentTerm: string
  previousAttempts: number
  lastAttemptType?: CollectionAttemptType
  contractTerms?: {
    lateFee?: number
    creditLimit?: number
  }
}

/**
 * API Response types
 */
export interface CollectionHistoryResponse {
  attempts: CollectionAttempt[]
  total: number
  page: number
  limit: number
}

export interface TriggerCollectionResponse {
  success: boolean
  results: Array<{
    type: CollectionAttemptType
    messageId?: string
    callSid?: string
    status: string
  }>
  toneLevel: ToneLevel
}

