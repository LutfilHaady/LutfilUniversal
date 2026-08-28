import { NextRequest, NextResponse } from 'next/server'
import {
  recalculateAllBuyerCreditScores,
  recalculateAllSupplierReliabilityScores,
} from '@/lib/utils/score-recalculation'

/**
 * GET /api/cron/scores
 * Vercel Cron endpoint - recalculates all scores periodically
 * 
 * To set up in Vercel:
 * 1. Go to Project Settings > Cron Jobs
 * 2. Add new cron job:
 *    - Path: /api/cron/scores
 *    - Schedule: 0 2 * * * (daily at 2 AM)
 * 
 * Or use external cron service:
 * - Call this endpoint via HTTP GET daily
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
    
    console.log('[Cron Scores] Starting score recalculation...')
    
    // Recalculate all buyer credit scores
    const buyerResults = await recalculateAllBuyerCreditScores()
    console.log('[Cron Scores] Buyer credit scores:', buyerResults)
    
    // Recalculate all supplier reliability scores
    const supplierResults = await recalculateAllSupplierReliabilityScores()
    console.log('[Cron Scores] Supplier reliability scores:', supplierResults)
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      buyers: buyerResults,
      suppliers: supplierResults,
    })
  } catch (error) {
    console.error('[Cron Scores] Error recalculating scores:', error)
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

