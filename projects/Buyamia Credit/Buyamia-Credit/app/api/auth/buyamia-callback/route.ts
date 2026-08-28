/**
 * Buyamia Authentication Callback API
 * 
 * GET /api/auth/buyamia-callback?token=xxx&state=xxx
 * 
 * ⚠️ DATABASE ACCESS RULES ⚠️
 * - READ-ONLY from Buyamia: Only API calls (GET requests)
 * - WRITE to our SQLite: Creates/updates credit profiles and sessions
 * - NEVER writes to Buyamia's PostgreSQL database
 * 
 * Handles redirect from Buyamia after login/signup:
 * 1. Validates origin/referrer (security)
 * 2. Validates state parameter (CSRF protection)
 * 3. Verifies token with Buyamia (READ-ONLY API call)
 * 4. Checks if account is verified (READ-ONLY)
 * 5. If verified → creates/updates credit profile in OUR database → logs in → redirects to dashboard
 * 6. If NOT verified → redirects to Buyamia register
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchBuyamiaUser } from '@/lib/buyamia-auth/client'
import { prisma } from '@/lib/prisma'
import { createSession, SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS } from '@/lib/auth'
import { validateBuyamiaOrigin, getOriginDomain } from '@/lib/security/origin-validation'
import { validateStateToken } from '@/lib/security/csrf'
import { validateRedirectUrl, getDefaultRedirectUrl } from '@/lib/security/redirect-validation'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'

// Helper to get Buyamia register URL
function getBuyamiaRegisterUrl(redirectTo: string): string {
  const encodedRedirect = encodeURIComponent(redirectTo)
  return `https://buyamia.com/register?redirect_to=${encodedRedirect}`
}

// Helper to get Buyamia login URL
function getBuyamiaLoginUrl(redirectTo: string): string {
  const encodedRedirect = encodeURIComponent(redirectTo)
  return `https://buyamia.com/login?redirect_to=${encodedRedirect}`
}

export async function GET(request: NextRequest) {
  try {
    // 1. SECURITY: Validate origin/referrer
    if (!validateBuyamiaOrigin(request)) {
      const originDomain = getOriginDomain(request)
      logger.warn({
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        originDomain,
        ip: request.headers.get('x-forwarded-for'),
        path: request.nextUrl.pathname,
      }, 'Blocked Buyamia callback - invalid origin')
      
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      )
    }
    
    // 2. SECURITY: Validate state parameter (CSRF protection)
    const { searchParams } = request.nextUrl
    const state = searchParams.get('state')
    
    if (!state) {
      logger.warn({
        ip: request.headers.get('x-forwarded-for'),
        origin: getOriginDomain(request),
      }, 'Buyamia callback missing state parameter')
      
      return NextResponse.json(
        { error: 'Missing state parameter' },
        { status: 400 }
      )
    }
    
    const stateValidation = validateStateToken(state)
    if (!stateValidation.valid) {
      logger.warn({
        state: state.substring(0, 8) + '...', // Log partial state for debugging
        ip: request.headers.get('x-forwarded-for'),
        origin: getOriginDomain(request),
      }, 'Buyamia callback invalid state token')
      
      return NextResponse.json(
        { error: 'Invalid or expired state token' },
        { status: 400 }
      )
    }
    
    // 3. Get token from query params or Authorization header
    const token = searchParams.get('token')
    const authHeader = request.headers.get('authorization')
    const authToken = authHeader?.replace('Bearer ', '') || token
    
    // Get cookies from request to pass to Buyamia API (for session-based auth)
    // Note: Cookies from buyamia.com won't be available here due to cross-domain restrictions
    const cookieHeader = request.headers.get('cookie') || ''

    // READ-ONLY: Fetch current logged-in user from Buyamia API
    // This reads from Buyamia, does NOT write to Buyamia's database
    // Use token if provided, otherwise fall back to cookies
    const authResult = await fetchBuyamiaUser(authToken || cookieHeader)

    if (!authResult.success || !authResult.user) {
      logger.error({
        error: authResult.error,
        origin: getOriginDomain(request),
      }, 'Buyamia user verification failed')
      
      // User not authenticated - redirect to Buyamia login
      const buyamiaLoginUrl = getBuyamiaLoginUrl(
        `${request.nextUrl.origin}/api/auth/buyamia-callback`
      )
      return NextResponse.redirect(buyamiaLoginUrl)
    }

    const buyamiaUser = authResult.user

    // Proceed with login/registration
    // WRITE to OUR SQLite database (NOT Buyamia's database)
    // Find or create credit platform user in our local database
    let user = await prisma.user.findFirst({
      where: { buyamiaUserId: buyamiaUser.userId } as any,
    })

    if (!user) {
      // First time - create credit profile automatically
      logger.info({
        buyamiaUserId: buyamiaUser.userId,
        type: buyamiaUser.type,
      }, 'Creating new credit profile')

      // Generate display userId (BJ#### or SP####)
      const prefix = buyamiaUser.type === 'BUYER' ? 'BJ' : 'SP'
      const count = await prisma.user.count({ where: { type: buyamiaUser.type } })
      const newUserId = `${prefix}${String(count + 1).padStart(4, '0')}`

      // WRITE to OUR SQLite database: Create credit profile
      // This writes to our local database, NOT Buyamia's database
      user = await prisma.user.create({
        data: {
          type: buyamiaUser.type,
          userId: newUserId,
          buyamiaUserId: buyamiaUser.userId,
          businessName: buyamiaUser.businessName || buyamiaUser.name || 'Business',
          phoneNumber: buyamiaUser.phone || '',
          address: null,
          creditScore: 50, // Default starting score
          profileCompleted: true, // Auto-completed since we're not asking extra questions
          inviteStatus: 'ACTIVE',
          invitedAt: new Date(),
        } as any,
      })
    } else {
      // WRITE to OUR SQLite database: Update last login
      // This writes to our local database, NOT Buyamia's database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
        },
      })
    }

    // WRITE to OUR SQLite database: Create session
    // This writes to our local Session table, NOT Buyamia's database
    const userAgent = request.headers.get('user-agent') || undefined
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor?.split(',')[0].trim() || 
                      request.headers.get('x-real-ip') || 
                      undefined

    const sessionToken = await createSession(user.id, userAgent, ipAddress)

    // 4. SECURITY: Validate redirect URL before redirecting
    const redirectTo = stateValidation.redirectTo || '/select-dashboard'
    const safeRedirect = validateRedirectUrl(redirectTo, request.nextUrl.origin)
    const finalRedirect = safeRedirect || getDefaultRedirectUrl(request.nextUrl.origin)
    
    logger.info({
      userId: user.userId,
      buyamiaUserId: buyamiaUser.userId,
      redirectTo: finalRedirect,
    }, 'Buyamia callback successful')
    
    // Create response and set cookie
    // Redirect to validated safe URL
    const response = NextResponse.redirect(new URL(finalRedirect, request.url))

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS)

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })

    return response

  } catch (error) {
    logger.error({
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      origin: getOriginDomain(request),
      ip: request.headers.get('x-forwarded-for'),
    }, 'Buyamia callback error')
    
    // On error, redirect to Buyamia register
    const buyamiaRegisterUrl = getBuyamiaRegisterUrl(
      `${request.nextUrl.origin}/api/auth/buyamia-callback`
    )
    return NextResponse.redirect(buyamiaRegisterUrl)
  }
}

