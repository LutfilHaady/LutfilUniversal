import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  determineToneLevel,
  generateWhatsAppMessage,
  generateVoiceCallScript,
  type CollectionContext,
} from '@/lib/ai/collections-orchestrator'
import { 
  sendWhatsAppMessage, 
  initiateVoiceCall,
  getTemplateForTone,
  prepareTemplateParams 
} from '@/lib/integrations/twilio'
import { calculateDaysOverdue, shouldTriggerCollection, getCollectionMilestone } from '@/lib/utils/collections'
import { normalizePhoneForTwilio } from '@/lib/utils'
import { CollectionAttemptType } from '@/lib/types/collections'

/**
 * POST /api/collections/trigger
 * Trigger collection attempt for an invoice
 */
export async function POST(request: NextRequest) {
  try {
    const { invoiceId, attemptType = 'both' } = await request.json()
    
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoiceId is required' },
        { status: 400 }
      )
    }
    
    // Get invoice details
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        buyer: true,
        supplier: true,
      },
    })
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }
    
    // Safety check: Don't send if invoice is already paid
    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { 
          error: 'Invoice is already paid',
          message: 'Collection attempt skipped - invoice status is PAID'
        },
        { status: 400 }
      )
    }
    
    // Don't send if invoice is defaulted (handled separately)
    if (invoice.status === 'DEFAULTED') {
      return NextResponse.json(
        { 
          error: 'Invoice is defaulted',
          message: 'Collection attempt skipped - invoice status is DEFAULTED'
        },
        { status: 400 }
      )
    }
    
    // Calculate days overdue
    const { daysOverdue, daysUntilDue } = calculateDaysOverdue(invoice.dueDate)
    
    // Get last collection attempt timestamp
    const lastAttempt = await prisma.collectionAttempt.findFirst({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    })
    const lastAttemptDate = lastAttempt?.createdAt || invoice.lastCollectionAttempt
    
    // Calculate current milestone
    const currentMilestone = getCollectionMilestone(daysUntilDue, daysOverdue)
    
    // Check if invoice meets collection timing criteria (milestone check)
    const shouldCollect = shouldTriggerCollection(
      daysUntilDue,
      daysOverdue,
      lastAttemptDate,
      invoice.status as any,
      currentMilestone
    )
    
    if (!shouldCollect) {
      return NextResponse.json(
        { 
          error: 'Invoice does not meet collection timing criteria',
          message: `Collection can only be triggered on specific milestones: T-3, T-1, T+0, T+1, T+3, T+7. Current: ${daysUntilDue > 0 ? `T-${daysUntilDue}` : `T+${daysOverdue}`}`,
          daysUntilDue,
          daysOverdue,
        },
        { status: 400 }
      )
    }
    
    // Get previous attempts count
    const previousAttempts = await prisma.collectionAttempt.count({
      where: { invoiceId },
    })
    
    // Determine tone level
    const toneLevel = determineToneLevel(daysUntilDue, daysOverdue, previousAttempts)
    
    // Get last attempt type (already fetched above, reuse it)
    
    // Create collection context
    const context: CollectionContext = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      buyerName: invoice.buyer.businessName,
      buyerPhone: normalizePhoneForTwilio(invoice.buyer.phoneNumber),
      amount: Number(invoice.amount),
      dueDate: invoice.dueDate,
      daysOverdue,
      paymentTerm: 'Net 30', // TODO: Get from contract/invoice
      previousAttempts,
      lastAttemptType: lastAttempt?.attemptType as string | undefined,
    }
    
    const results = []
    const now = new Date()
    
    // Send WhatsApp message (only method enabled)
    if (attemptType === 'whatsapp_message' || attemptType === 'both') {
      try {
        // Check if we should use template
        const templateSid = getTemplateForTone(toneLevel)
        let messageId: string
        let messageContent: string | null = null
        
        if (templateSid) {
          // Use template - generate a preview of what the template would say
          const templateParams = prepareTemplateParams(
            context.buyerName,
            context.invoiceNumber,
            context.amount,
            context.dueDate,
            context.daysOverdue,
            toneLevel
          )
          
          // For templates, create a human-readable preview message
          const isReminder = toneLevel.toLowerCase() === 'friendly' || toneLevel.toLowerCase() === 'professional'
          if (isReminder) {
            messageContent = `Hi ${context.buyerName},\n\nThis is a reminder for invoice ${context.invoiceNumber} with amount Rp ${context.amount.toLocaleString('id-ID')} which is due on ${new Date(context.dueDate).toLocaleDateString('en-US')}.\n\nPlease make payment before the due date. Thank you!`
          } else {
            messageContent = `Hi ${context.buyerName},\n\nInvoice ${context.invoiceNumber} with amount Rp ${context.amount.toLocaleString('id-ID')} is ${context.daysOverdue} days overdue.\n\nPlease make payment immediately to avoid further consequences. Thank you!`
          }
          
          messageId = await sendWhatsAppMessage(context.buyerPhone, '', {
            useTemplate: true,
            templateName: templateSid,
            templateParams,
          })
        } else {
          // Use AI-generated message (session message - works if user messaged within 24h)
          messageContent = await generateWhatsAppMessage(context, toneLevel)
          messageId = await sendWhatsAppMessage(context.buyerPhone, messageContent)
        }
        
        // Log attempt
        await prisma.collectionAttempt.create({
          data: {
            invoiceId: invoice.id,
            attemptType: CollectionAttemptType.WHATSAPP_MESSAGE,
            toneLevel: toneLevel,
            status: 'sent',
            messageId,
            messageContent: messageContent || null,
          } as any, // Temporary: TypeScript may need IDE restart to pick up new Prisma types
        })
        
        results.push({
          type: 'whatsapp_message',
          messageId,
          status: 'sent',
        })
      } catch (error: any) {
        console.error('Error sending WhatsApp message:', error)
        const errorMessage = error?.message || error?.toString() || 'Unknown error'
        const errorCode = error?.code || error?.status || 'N/A'
        console.error('Full error details:', {
          message: errorMessage,
          code: errorCode,
          error: error
        })
        results.push({
          type: 'whatsapp_message',
          status: 'failed',
          error: errorMessage,
          errorCode: errorCode,
        })
      }
    }
    
    // Voice calls disabled - WhatsApp messages only
    // (Code kept for future reference but not executed)
    
    // Update invoice
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        lastCollectionAttempt: now,
        collectionStatus: 'IN_PROGRESS',
      },
    })
    
    return NextResponse.json({
      success: true,
      results,
      toneLevel,
      invoiceNumber: invoice.invoiceNumber,
      daysOverdue,
      daysUntilDue,
    })
  } catch (error) {
    console.error('Collection trigger error:', error)
    return NextResponse.json(
      {
        error: 'Failed to trigger collection',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

