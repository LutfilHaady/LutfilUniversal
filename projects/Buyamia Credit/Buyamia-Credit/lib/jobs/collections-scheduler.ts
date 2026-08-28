import { prisma } from '@/lib/prisma'
import {
  calculateDaysOverdue,
  shouldTriggerCollection,
  determineAttemptType,
  shouldCollectBasedOnStatus,
  getCollectionMilestone,
} from '@/lib/utils/collections'
import { recalculateBuyerCreditScore } from '@/lib/utils/score-recalculation'

// InvoiceStatus type matches the schema string values
type InvoiceStatus = 'PENDING' | 'PAID' | 'DUE_SOON' | 'OVERDUE_3' | 'OVERDUE_7' | 'DEFAULTED'

/**
 * Process collection queue - finds invoices that need collection attempts
 * This should run as a cron job (e.g., every hour)
 * 
 * @returns Object with count of processed invoices
 */
export async function processCollectionQueue(): Promise<{
  processed: number
  attempted: number
  skipped: number
  errors: number
}> {
  const now = new Date()
  let processed = 0
  let attempted = 0
  let skipped = 0
  let errors = 0
  
  try {
    // Find invoices that need collection
    const invoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: ['PENDING', 'DUE_SOON', 'OVERDUE_3', 'OVERDUE_7'],
        },
      },
      include: {
        buyer: true,
        supplier: true,
        collectionAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    
    console.log(`[Collections Scheduler] Found ${invoices.length} invoices to check`)
    
    for (const invoice of invoices) {
      processed++
      
      try {
        // Calculate days overdue/until due
        const { daysOverdue, daysUntilDue } = calculateDaysOverdue(invoice.dueDate)
        
        // Update invoice status based on days overdue
        let newStatus: InvoiceStatus = invoice.status as InvoiceStatus
        let statusChanged = false
        
        if (daysOverdue >= 14 && invoice.status !== 'DEFAULTED') {
          // Mark as defaulted if 14+ days overdue
          newStatus = 'DEFAULTED'
          statusChanged = invoice.status !== 'DEFAULTED'
        } else if (daysOverdue >= 7 && invoice.status !== 'OVERDUE_7' && invoice.status !== 'DEFAULTED') {
          // Mark as OVERDUE_7 if 7+ days overdue
          newStatus = 'OVERDUE_7'
          statusChanged = invoice.status !== 'OVERDUE_7'
        } else if (daysOverdue >= 3 && invoice.status !== 'OVERDUE_3' && invoice.status !== 'OVERDUE_7' && invoice.status !== 'DEFAULTED') {
          // Mark as OVERDUE_3 if 3+ days overdue
          newStatus = 'OVERDUE_3'
          statusChanged = invoice.status !== 'OVERDUE_3'
        } else if (daysUntilDue <= 3 && daysUntilDue > 0 && invoice.status === 'PENDING') {
          // Mark as DUE_SOON if due within 3 days
          newStatus = 'DUE_SOON'
          statusChanged = invoice.status !== 'DUE_SOON'
        }
        
        // Update invoice status if changed
        if (statusChanged) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: newStatus },
          })
          
          // Recalculate buyer's credit score when status changes to overdue/defaulted
          if (newStatus === 'OVERDUE_3' || newStatus === 'OVERDUE_7' || newStatus === 'DEFAULTED') {
            try {
              await recalculateBuyerCreditScore(invoice.buyerId)
              console.log(`  - ✅ Updated credit score for buyer due to ${newStatus} status`)
            } catch (error) {
              console.error(`  - ⚠️ Failed to update credit score:`, error)
            }
          }
        }
        
        // Use the most recent collection attempt timestamp (more accurate than invoice.lastCollectionAttempt)
        const lastAttempt = invoice.collectionAttempts?.[0]?.createdAt || invoice.lastCollectionAttempt
        
        // Calculate current milestone
        const currentMilestone = getCollectionMilestone(daysUntilDue, daysOverdue)
        
        console.log(`[Collections Scheduler] Checking invoice ${invoice.invoiceNumber}:`)
        console.log(`  - Due date: ${invoice.dueDate.toISOString()}`)
        console.log(`  - Days until due: ${daysUntilDue}, Days overdue: ${daysOverdue}`)
        console.log(`  - Current milestone: ${currentMilestone}`)
        console.log(`  - Status: ${invoice.status} → ${newStatus}${statusChanged ? ' (updated)' : ''}`)
        console.log(`  - Last attempt: ${lastAttempt ? lastAttempt.toISOString() : 'Never'}`)
        
        // Check if should collect based on status
        if (!shouldCollectBasedOnStatus(newStatus)) {
          console.log(`  - ❌ Skipped: Status ${newStatus} doesn't require collection`)
          skipped++
          continue
        }
        
        // Check if should trigger collection based on timing
        const shouldCollect = shouldTriggerCollection(
          daysUntilDue,
          daysOverdue,
          lastAttempt,
          newStatus,
          currentMilestone
        )
        
        if (!shouldCollect) {
          console.log(`  - ❌ Skipped: Doesn't meet collection timing criteria`)
          skipped++
          continue
        }
        
        console.log(`  - ✅ Will trigger collection`)
        
        // Double-check invoice is still not paid (safety check)
        if (newStatus === 'PAID' || newStatus === 'DEFAULTED') {
          skipped++
          console.log(`[Collections Scheduler] Skipping invoice ${invoice.invoiceNumber} - status is ${newStatus}`)
          continue
        }
        
        // Determine attempt type (WhatsApp messages only)
        const attemptType = determineAttemptType(daysUntilDue, daysOverdue)
        
        // Map attempt type to API format - only WhatsApp messages
        const apiAttemptType: 'whatsapp_message' | 'whatsapp_call' | 'both' = 'whatsapp_message'
        
        // Trigger collection attempt via API
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/collections/trigger`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invoiceId: invoice.id,
              attemptType: apiAttemptType,
            }),
          }
        )
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(
            `[Collections Scheduler] Failed to trigger collection for invoice ${invoice.invoiceNumber}:`,
            errorText
          )
          errors++
          continue
        }
        
        attempted++
        console.log(
          `[Collections Scheduler] Triggered collection for invoice ${invoice.invoiceNumber} (${apiAttemptType})`
        )
      } catch (error) {
        console.error(
          `[Collections Scheduler] Error processing invoice ${invoice.invoiceNumber}:`,
          error
        )
        errors++
      }
    }
    
    return {
      processed,
      attempted,
      skipped,
      errors,
    }
  } catch (error) {
    console.error('[Collections Scheduler] Fatal error:', error)
    throw error
  }
}

/**
 * Process a single invoice for collection
 * Useful for manual triggers or testing
 */
export async function processSingleInvoice(invoiceId: string): Promise<{
  success: boolean
  message: string
}> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        buyer: true,
        supplier: true,
      },
    })
    
    if (!invoice) {
      return {
        success: false,
        message: 'Invoice not found',
      }
    }
    
    const { daysOverdue, daysUntilDue } = calculateDaysOverdue(invoice.dueDate)
    
    if (!shouldCollectBasedOnStatus(invoice.status as InvoiceStatus)) {
      return {
        success: false,
        message: `Invoice status ${invoice.status} does not require collection`,
      }
    }
    
    // Calculate current milestone
    const currentMilestone = getCollectionMilestone(daysUntilDue, daysOverdue)
    
    const shouldCollect = shouldTriggerCollection(
      daysUntilDue,
      daysOverdue,
      invoice.lastCollectionAttempt,
      invoice.status as InvoiceStatus,
      currentMilestone
    )
    
    if (!shouldCollect) {
      return {
        success: false,
        message: 'Invoice does not meet collection timing criteria',
      }
    }
    
    const attemptType = determineAttemptType(daysUntilDue, daysOverdue)
    // WhatsApp messages only - no calls
    const apiAttemptType: 'whatsapp_message' | 'whatsapp_call' | 'both' = 'whatsapp_message'
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/collections/trigger`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          attemptType: apiAttemptType,
        }),
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        message: `Failed to trigger collection: ${errorText}`,
      }
    }
    
    return {
      success: true,
      message: `Collection triggered successfully (${apiAttemptType})`,
    }
  } catch (error) {
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

