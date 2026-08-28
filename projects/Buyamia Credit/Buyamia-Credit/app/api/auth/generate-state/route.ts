/**
 * Generate State Token API
 * 
 * GET /api/auth/generate-state?redirectTo=/dashboard
 * 
 * Generates a CSRF state token for Buyamia authentication redirect.
 * This must be called server-side to ensure secure token generation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateStateToken } from '@/lib/security/csrf'
import { validateRedirectUrl } from '@/lib/security/redirect-validation'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const redirectTo = searchParams.get('redirectTo') || '/select-dashboard'
    
    // Validate redirect URL
    const baseUrl = request.nextUrl.origin
    const safeRedirect = validateRedirectUrl(redirectTo, baseUrl) || '/select-dashboard'
    
    // Generate state token
    const state = generateStateToken(safeRedirect)
    
    logger.info({
      redirectTo: safeRedirect,
      statePrefix: state.substring(0, 8),
    }, 'State token generated')
    
    return NextResponse.json({
      state,
      redirectTo: safeRedirect,
    })
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to generate state token')
    
    return NextResponse.json(
      { error: 'Failed to generate state token' },
      { status: 500 }
    )
  }
}
