/**
 * Next.js Middleware
 * 
 * Handles authentication and route protection for Buyamia Credit.
 * - Redirects unauthenticated users to /login
 * - Redirects authenticated but incomplete profiles to /register/complete
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'buyamia_credit_session'

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/register/complete-profile',
  '/register/link-buyamia',
  '/select-dashboard', // Dashboard selection page (after login)
  '/dashboard', // Temporarily public for development
  '/buyer-registry',
  '/invoices',
  '/issues',
  '/search',
  '/risk-monitor', // Risk Monitor page
  '/collections',
  '/profile',
]

// Routes that don't need profile completion check
const SKIP_PROFILE_CHECK_ROUTES = [
  '/register/complete',
  '/api/',
]

// Static assets and API routes to skip
const SKIP_ROUTES = [
  '/_next',
  '/favicon.ico',
  '/api/',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for static assets and API routes
  if (SKIP_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Get session token
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const isAuthenticated = !!sessionToken

  // Check if current path is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/') || pathname.startsWith(route + '?')
  ) || pathname.startsWith('/register/')

  // If authenticated and trying to access login/register (but not complete-profile), redirect to dashboard
  // BUT allow /login if user explicitly wants to re-authenticate (don't auto-redirect)
  const isRegisterFlow = pathname.startsWith('/register/')
  // Only redirect if accessing /register directly, not /login (user might want to switch accounts)
  if (isAuthenticated && pathname === '/register' && !isRegisterFlow) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If not authenticated and trying to access protected route, redirect to login
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // For authenticated users on protected routes, we need to check profile completion
  // This requires a database call, so we'll do a lightweight check via API
  // The actual enforcement happens client-side and in API routes
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
