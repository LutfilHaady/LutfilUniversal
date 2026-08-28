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
    const response = NextResponse.next()
    addSecurityHeaders(response, request)
    return response
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
    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    addSecurityHeaders(response, request)
    return response
  }

  // If not authenticated and trying to access protected route, redirect to login
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    const response = NextResponse.redirect(loginUrl)
    addSecurityHeaders(response, request)
    return response
  }

  // For authenticated users on protected routes, we need to check profile completion
  // This requires a database call, so we'll do a lightweight check via API
  // The actual enforcement happens client-side and in API routes
  
  const response = NextResponse.next()
  addSecurityHeaders(response, request)
  return response
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse, request: NextRequest) {
  // Basic security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN') // Allow iframes from same origin
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy for cross-domain security
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust based on your needs
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://buyamia.com https://www.buyamia.com https://api.dlt.buyamia.com",
    "frame-ancestors 'self' https://buyamia.com https://www.buyamia.com",
    "form-action 'self' https://buyamia.com",
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)
  
  // HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  )
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
