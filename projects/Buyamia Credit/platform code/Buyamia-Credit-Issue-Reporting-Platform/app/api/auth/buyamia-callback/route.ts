/**
 * Buyamia Authentication Callback API
 * 
 * GET /api/auth/buyamia-callback?token=xxx
 * 
 * ⚠️ DATABASE ACCESS RULES ⚠️
 * - READ-ONLY from Buyamia: Only API calls (GET requests)
 * - WRITE to our SQLite: Creates/updates credit profiles and sessions
 * - NEVER writes to Buyamia's PostgreSQL database
 * 
 * Handles redirect from Buyamia after login/signup:
 * 1. Verifies token with Buyamia (READ-ONLY API call)
 * 2. Checks if account is verified (READ-ONLY)
 * 3. If verified → creates/updates credit profile in OUR database → logs in → redirects to dashboard
 * 4. If NOT verified → redirects to Buyamia register
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchBuyamiaUser } from '@/lib/buyamia-auth/client'
import { prisma } from '@/lib/prisma'
import { createSession, SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS } from '@/lib/auth'

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
    // Check if this is a direct access (not from Buyamia redirect)
    // We can check the referer header to see if it came from Buyamia
    const referer = request.headers.get('referer') || ''
    const isFromBuyamia = referer.includes('buyamia.com')
    
    // Get cookies from request to pass to Buyamia API (for session-based auth)
    // Note: Cookies from buyamia.com won't be available here due to cross-domain restrictions
    // We'll need to get user data another way - check if Buyamia passes user info in URL params
    const { searchParams } = request.nextUrl
    
    // Try to get user data from query params first (if Buyamia passes it)
    // Otherwise, we'll need to call the API with proper auth
    
    // For now, get cookies (might be empty due to cross-domain)
    const cookieHeader = request.headers.get('cookie') || ''

    // READ-ONLY: Fetch current logged-in user from Buyamia API
    // This reads from Buyamia, does NOT write to Buyamia's database
    const authResult = await fetchBuyamiaUser(cookieHeader)

    if (!authResult.success || !authResult.user) {
      console.error('[BuyamiaCallback] Failed to fetch user:', authResult.error)
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
      console.log('[BuyamiaCallback] Creating new credit profile for:', buyamiaUser.userId)

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

    // Create response and set cookie
    // Redirect to dashboard selection page so user can choose which dashboard to view
    const selectDashboardUrl = new URL('/select-dashboard', request.url)
    const response = NextResponse.redirect(selectDashboardUrl)

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
    console.error('[BuyamiaCallback] Error:', error)
    
    // On error, redirect to Buyamia register
    const buyamiaRegisterUrl = getBuyamiaRegisterUrl(
      `${request.nextUrl.origin}/api/auth/buyamia-callback`
    )
    return NextResponse.redirect(buyamiaRegisterUrl)
  }
}

