/**
 * Logout API
 * 
 * POST /api/auth/logout
 * 
 * Deletes the user's session and clears the session cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { deleteSession, SESSION_COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Get session token from cookie
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (sessionToken) {
      // Delete the session from database
      await deleteSession(sessionToken)
    }

    // Create response and clear cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    response.cookies.delete(SESSION_COOKIE_NAME)

    return response

  } catch (error) {
    console.error('[API] Logout error:', error)
    
    // Still clear the cookie even if there's an error
    const response = NextResponse.json({
      success: true,
      message: 'Logged out'
    })
    response.cookies.delete(SESSION_COOKIE_NAME)
    
    return response
  }
}



