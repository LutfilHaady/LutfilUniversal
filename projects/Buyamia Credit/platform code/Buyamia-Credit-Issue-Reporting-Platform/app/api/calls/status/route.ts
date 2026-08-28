import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/calls/status
 * Twilio webhook for call status updates
 * This endpoint is called by Twilio when call status changes
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const duration = formData.get('CallDuration') as string
    const recordingUrl = formData.get('RecordingUrl') as string
    
    if (!callSid) {
      return NextResponse.json(
        { error: 'CallSid is required' },
        { status: 400 }
      )
    }
    
    // Find call by SID
    const call = await prisma.call.findFirst({
      where: { callSid },
    })
    
    if (!call) {
      console.warn(`Call not found for SID: ${callSid}`)
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }
    
    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      'queued': 'PENDING',
      'ringing': 'IN_PROGRESS',
      'in-progress': 'IN_PROGRESS',
      'completed': 'COMPLETED',
      'busy': 'BUSY',
      'no-answer': 'NO_ANSWER',
      'failed': 'FAILED',
      'canceled': 'FAILED',
    }
    
    const updateData: any = {
      status: statusMap[callStatus] || 'FAILED',
    }
    
    if (callStatus === 'completed') {
      updateData.endedAt = new Date()
      updateData.duration = duration ? parseInt(duration) : null
      updateData.recordingUrl = recordingUrl || null
    }
    
    await prisma.call.update({
      where: { id: call.id },
      data: updateData,
    })
    
    // Update collection attempt status
    const attemptStatusMap: Record<string, string> = {
      'completed': 'ANSWERED',
      'no-answer': 'NO_ANSWER',
      'busy': 'BUSY',
      'failed': 'FAILED',
      'canceled': 'FAILED',
    }
    
    const attemptStatus = attemptStatusMap[callStatus] || 'FAILED'
    
    await prisma.collectionAttempt.updateMany({
      where: { callId: call.id },
      data: {
        status: attemptStatus as any,
      },
    })
    
    return NextResponse.json({
      success: true,
      callId: call.id,
      status: updateData.status,
    })
  } catch (error) {
    console.error('Call status update error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update call status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

