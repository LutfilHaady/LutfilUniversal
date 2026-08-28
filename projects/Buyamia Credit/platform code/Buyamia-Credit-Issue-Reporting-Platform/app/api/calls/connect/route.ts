import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateTwiML } from '@/lib/integrations/twilio'

/**
 * GET /api/calls/connect
 * Twilio webhook when call connects - returns TwiML
 * This endpoint is called by Twilio when the call is answered
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const invoiceId = searchParams.get('invoiceId')
    
    if (!invoiceId) {
      return new NextResponse('Missing invoiceId', {
        status: 400,
        headers: { 'Content-Type': 'text/xml' },
      })
    }
    
    // Get call record
    const call = await prisma.call.findFirst({
      where: {
        invoiceId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    })
    
    if (!call || !call.aiResponse) {
      return new NextResponse('Call not found or no script available', {
        status: 404,
        headers: { 'Content-Type': 'text/xml' },
      })
    }
    
    // Update call status
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    })
    
    // Generate TwiML with AI script
    const twiml = generateTwiML(call.aiResponse)
    
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('Call connect error:', error)
    return new NextResponse('Internal server error', {
      status: 500,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}

