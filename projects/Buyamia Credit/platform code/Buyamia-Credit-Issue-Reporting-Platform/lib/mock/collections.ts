/**
 * Mock Collections Data
 * 
 * This mock data matches the TypeScript interfaces in lib/types/collections.ts
 * When backend is ready, replace these with actual API calls.
 */

import {
  Call,
  CollectionAttempt,
  InvoiceWithCollections,
  CollectionStats,
  CrossSupplierPaymentHistory,
  CallStatus,
  CallDirection,
  ToneLevel,
  CollectionAttemptType,
  CollectionAttemptStatus,
  CollectionStatus,
} from '@/lib/types/collections'

// Mock collection attempts
export const mockCollectionAttempts: CollectionAttempt[] = [
  {
    id: 'ca1',
    invoiceId: 'inv1',
    attemptType: CollectionAttemptType.WHATSAPP_MESSAGE,
    toneLevel: ToneLevel.FRIENDLY,
    status: CollectionAttemptStatus.DELIVERED,
    messageId: 'msg_12345',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    invoice: {
      invoiceNumber: 'INV-2024-001',
      amount: 1500000,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      buyer: {
        userId: 'BJ1045',
        businessName: 'Restaurant Sederhana',
        phoneNumber: '+62 812-3456-7890',
      },
    },
  },
  {
    id: 'ca2',
    invoiceId: 'inv1',
    attemptType: CollectionAttemptType.WHATSAPP_CALL,
    toneLevel: ToneLevel.PROFESSIONAL,
    status: CollectionAttemptStatus.ANSWERED,
    callId: 'call1',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    call: {
      id: 'call1',
      invoiceId: 'inv1',
      buyerId: 'BJ1045', // Real buyer ID
      supplierId: 'SP0023', // Real supplier ID
      direction: CallDirection.OUTBOUND,
      status: CallStatus.COMPLETED,
      toneLevel: ToneLevel.PROFESSIONAL,
      callSid: 'CA1234567890',
      duration: 120, // 2 minutes
      recordingUrl: 'https://api.twilio.com/recordings/rec123',
      transcript: 'Agent: Halo, ini dari Buyamia Credit Platform. Kami ingin mengingatkan bahwa invoice INV-2024-001 akan jatuh tempo besok. Buyer: Baik, terima kasih informasinya.',
      aiResponse: 'Halo, ini dari Buyamia Credit Platform. Kami ingin mengingatkan bahwa invoice INV-2024-001 untuk Rp 1,500,000 akan jatuh tempo besok. Apakah Anda sudah mempersiapkan pembayaran?',
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 120 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    invoice: {
      invoiceNumber: 'INV-2024-001',
      amount: 1500000,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
      buyer: {
        userId: 'BJ1045',
        businessName: 'Restaurant Sederhana',
        phoneNumber: '+62 812-3456-7890',
      },
    },
  },
  {
    id: 'ca3',
    invoiceId: 'inv2',
    attemptType: CollectionAttemptType.WHATSAPP_MESSAGE,
    toneLevel: ToneLevel.URGENT,
    status: CollectionAttemptStatus.READ,
    messageId: 'msg_12347',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    invoice: {
      invoiceNumber: 'INV-2024-002',
      amount: 2500000,
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day overdue
      buyer: {
        userId: 'BJ1045',
        businessName: 'Restaurant Sederhana',
        phoneNumber: '+62 812-3456-7890',
      },
    },
  },
  {
    id: 'ca4',
    invoiceId: 'inv2',
    attemptType: CollectionAttemptType.WHATSAPP_CALL,
    toneLevel: ToneLevel.URGENT,
    status: CollectionAttemptStatus.NO_ANSWER,
    callId: 'call2',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    call: {
      id: 'call2',
      invoiceId: 'inv2',
      buyerId: 'BJ1045', // Real buyer ID
      supplierId: 'SP0023', // Real supplier ID
      direction: CallDirection.OUTBOUND,
      status: CallStatus.NO_ANSWER,
      toneLevel: ToneLevel.URGENT,
      callSid: 'CA1234567891',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    invoice: {
      invoiceNumber: 'INV-2024-002',
      amount: 2500000,
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      buyer: {
        userId: 'BJ1045',
        businessName: 'Restaurant Sederhana',
        phoneNumber: '+62 812-3456-7890',
      },
    },
  },
  {
    id: 'ca5',
    invoiceId: 'inv3',
    attemptType: CollectionAttemptType.WHATSAPP_CALL,
    toneLevel: ToneLevel.FIRM,
    status: CollectionAttemptStatus.ANSWERED,
    callId: 'call3',
    response: 'Buyer confirmed payment will be made tomorrow',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    call: {
      id: 'call3',
      invoiceId: 'inv3',
      buyerId: 'BJ1123', // Real buyer ID
      supplierId: 'SP0023', // Real supplier ID
      direction: CallDirection.OUTBOUND,
      status: CallStatus.COMPLETED,
      toneLevel: ToneLevel.FIRM,
      callSid: 'CA1234567892',
      duration: 180, // 3 minutes
      recordingUrl: 'https://api.twilio.com/recordings/rec124',
      transcript: 'Agent: Invoice INV-2024-003 sudah 3 hari overdue. Buyer: Maaf, saya akan transfer besok pagi.',
      aiResponse: 'Halo, ini dari Buyamia Credit Platform. Invoice INV-2024-003 untuk Rp 3,200,000 sudah 3 hari overdue. Mohon segera lakukan pembayaran untuk menghindari denda keterlambatan.',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 180 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    invoice: {
      invoiceNumber: 'INV-2024-003',
      amount: 3200000,
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days overdue
      buyer: {
        userId: 'BJ1123',
        businessName: 'Hotel Grand',
        phoneNumber: '+62 812-9999-8888',
      },
    },
  },
]

// Mock invoices with collection info
export const mockInvoicesWithCollections: InvoiceWithCollections[] = [
  {
    id: 'inv1',
    invoiceNumber: 'INV-2024-001',
    buyerId: 'BJ1045',
    supplierId: 'SP0023',
    amount: 1500000,
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
    status: 'DUE_SOON',
    lastCollectionAttempt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    collectionStatus: CollectionStatus.IN_PROGRESS,
    daysUntilDue: 1,
    collectionAttempts: mockCollectionAttempts.filter(ca => ca.invoiceId === 'inv1'),
  },
  {
    id: 'inv2',
    invoiceNumber: 'INV-2024-002',
    buyerId: 'BJ1045',
    supplierId: 'SP0023',
    amount: 2500000,
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day overdue
    status: 'OVERDUE',
    lastCollectionAttempt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    collectionStatus: CollectionStatus.IN_PROGRESS,
    daysOverdue: 1,
    collectionAttempts: mockCollectionAttempts.filter(ca => ca.invoiceId === 'inv2'),
  },
  {
    id: 'inv3',
    invoiceNumber: 'INV-2024-003',
    buyerId: 'BJ1123',
    supplierId: 'SP0023',
    amount: 3200000,
    dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days overdue
    status: 'OVERDUE',
    lastCollectionAttempt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    collectionStatus: CollectionStatus.IN_PROGRESS,
    daysOverdue: 3,
    collectionAttempts: mockCollectionAttempts.filter(ca => ca.invoiceId === 'inv3'),
  },
  {
    id: 'inv4',
    invoiceNumber: 'INV-2024-004',
    buyerId: 'BJ1089',
    supplierId: 'SP0023',
    amount: 800000,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    status: 'PENDING',
    collectionStatus: CollectionStatus.PENDING,
    daysUntilDue: 2,
    collectionAttempts: [],
  },
]

// Mock collection statistics
export const mockCollectionStats: CollectionStats = {
  totalAttempts: 15,
  activeCollections: 3,
  responseRate: 65, // 65% of attempts get response
  paymentRate: 45, // 45% pay after collection attempt
  averageTimeToPayment: 2.5, // Average 2.5 days to payment after collection
  totalOutstanding: 7200000, // Rp 7.2M
  buyersNotResponding: 1, // 1 buyer not responding
}

// Mock cross-supplier payment history (for Search page)
export const mockCrossSupplierPaymentHistory: Record<string, CrossSupplierPaymentHistory> = {
  'BJ1045': {
    totalInvoices: 24,
    paidInvoices: 18,
    overdueInvoices: 3,
    totalOutstanding: 4500000, // Rp 4.5M across all suppliers
    suppliersCount: 3, // Owing to 3 suppliers
    lastPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    averagePaymentDelay: 2.5,
    nonPaymentReports: 1, // 1 supplier reported non-payment
    collectionAttemptsCount: 8, // 8 collection attempts across all suppliers
  },
  'BJ1123': {
    totalInvoices: 15,
    paidInvoices: 8,
    overdueInvoices: 5,
    totalOutstanding: 12000000, // Rp 12M across all suppliers
    suppliersCount: 4, // Owing to 4 suppliers
    lastPaymentDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    averagePaymentDelay: 7.2,
    nonPaymentReports: 3, // 3 suppliers reported non-payment
    collectionAttemptsCount: 15, // 15 collection attempts
  },
  'BJ1089': {
    totalInvoices: 12,
    paidInvoices: 12,
    overdueInvoices: 0,
    totalOutstanding: 0,
    suppliersCount: 2,
    lastPaymentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    averagePaymentDelay: 0,
    nonPaymentReports: 0,
    collectionAttemptsCount: 0,
  },
}

