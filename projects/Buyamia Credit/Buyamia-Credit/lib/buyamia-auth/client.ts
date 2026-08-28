/**
 * Buyamia Authentication Client
 * 
 * ⚠️ READ-ONLY ACCESS TO BUYAMIA DATABASE ⚠️
 * 
 * This module ONLY reads from Buyamia via API calls.
 * We NEVER write to Buyamia's PostgreSQL database.
 * 
 * All writes go to our local SQLite database (via Prisma).
 * 
 * Handles communication with Buyamia's authentication API:
 * - Verifies tokens from Buyamia (GET request only)
 * - Fetches user information (GET request only)
 * - Checks account verification status (GET request only)
 */

const BUYAMIA_API_BASE = process.env.BUYAMIA_API_BASE_URL || 'https://api.dlt.buyamia.com'
const BUYAMIA_API_KEY = process.env.BUYAMIA_API_KEY // Optional API key for internal calls

export interface BuyamiaUser {
  userId: string // UUID from Buyamia
  type: 'BUYER' | 'SUPPLIER'
  email: string | null
  phone: string | null
  name: string
  businessName: string | null
  isVerified: boolean // Account verification status
  emailVerified?: boolean
  phoneVerified?: boolean
}

export interface BuyamiaAuthResponse {
  success: boolean
  user?: BuyamiaUser
  error?: string
}

/**
 * Fetch current logged-in user from Buyamia API
 * 
 * ⚠️ READ-ONLY: Only GET request to Buyamia API
 * Does NOT write to Buyamia's database.
 * 
 * @param cookies - Optional cookies string from request (for session-based auth)
 * @returns User information if available
 */
export async function fetchBuyamiaUser(cookies?: string): Promise<BuyamiaAuthResponse> {
  try {
    // READ-ONLY: GET request only - no writes to Buyamia database
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(BUYAMIA_API_KEY && { 'X-API-Key': BUYAMIA_API_KEY }),
    }

    // If cookies provided, pass them for session-based auth
    if (cookies) {
      headers['Cookie'] = cookies
    }

    const response = await fetch(`${BUYAMIA_API_BASE}/v1/users/me`, {
      method: 'GET',
      headers,
      credentials: 'include', // Include cookies if using session-based auth
    })

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          error: 'User not authenticated',
        }
      }
      
      return {
        success: false,
        error: `Buyamia API error: ${response.status}`,
      }
    }

    const data = await response.json()

    // Expected response format from Buyamia:
    // {
    //   userId: "uuid",
    //   type: "BUYER" | "SUPPLIER",
    //   email: "...",
    //   phone: "...",
    //   name: "...",
    //   businessName: "...",
    //   isVerified: true/false,
    //   emailVerified: true/false,
    //   phoneVerified: true/false
    // }

    return {
      success: true,
      user: {
        userId: data.userId || data.id,
        type: data.type,
        email: data.email || null,
        phone: data.phone || data.phoneNumber || null,
        name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown',
        businessName: data.businessName || data.name || null,
        isVerified: data.isVerified === true || (data.emailVerified && data.phoneVerified),
        emailVerified: data.emailVerified,
        phoneVerified: data.phoneVerified,
      },
    }
  } catch (error) {
    console.error('[BuyamiaAuth] Fetch user error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user',
    }
  }
}

/**
 * @deprecated Use fetchBuyamiaUser instead
 * Kept for backward compatibility
 */
export async function verifyBuyamiaToken(token: string): Promise<BuyamiaAuthResponse> {
  // For now, redirect to new function
  // If token-based auth is needed, we can add it back
  return fetchBuyamiaUser()
}

/**
 * Check if account is verified in Buyamia
 * 
 * @param cookies - Optional cookies string from request
 * @returns true if account is verified, false otherwise
 */
export async function isAccountVerified(cookies?: string): Promise<boolean> {
  const result = await fetchBuyamiaUser(cookies)
  return result.success && result.user?.isVerified === true
}

/**
 * Get Buyamia login URL with redirect
 * 
 * @param redirectTo - URL to redirect back to after login
 * @returns Buyamia login URL
 */
export function getBuyamiaLoginUrl(redirectTo: string): string {
  const encodedRedirect = encodeURIComponent(redirectTo)
  // Use buyamia.com for login page, not API base URL
  return `https://buyamia.com/login?redirect_to=${encodedRedirect}`
}

/**
 * Get Buyamia register URL with redirect
 * 
 * @param redirectTo - URL to redirect back to after registration
 * @returns Buyamia register URL
 */
export function getBuyamiaRegisterUrl(redirectTo: string): string {
  const encodedRedirect = encodeURIComponent(redirectTo)
  return `${BUYAMIA_API_BASE}/register?redirect_to=${encodedRedirect}`
}

