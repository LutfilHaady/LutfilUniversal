import { NextRequest, NextResponse } from 'next/server'
import { processCollectionQueue } from '@/lib/jobs/collections-scheduler'

/**
 * GET /api/cron/collections
 * Vercel Cron endpoint - runs on schedule
 * 
 * To set up in Vercel:
 * 1. Go to Project Settings > Cron Jobs
 * 2. Add new cron job:
 *    - Path: /api/cron/collections
 *    - Schedule: 0 * * * * (every hour)
 * 
 * Or use external cron service:
 * - Call this endpoint via HTTP GET every hour
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('[Cron] Starting collection queue processing...')
    const result = await processCollectionQueue()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    console.error('[Cron] Error processing collection queue:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

