/**
 * Redirect URL Validation
 * 
 * Prevents open redirect vulnerabilities by validating
 * that redirect URLs are safe and within allowed paths.
 */

/**
 * Allowed redirect paths after authentication
 */
const ALLOWED_REDIRECT_PATHS = [
  '/dashboard',
  '/select-dashboard',
  '/invoices',
  '/collections',
  '/issues',
  '/risk-monitor',
  '/buyer-registry',
  '/profile',
  '/search',
  '/ai-assistant',
]

/**
 * Validate that a redirect URL is safe
 * 
 * @param url - The redirect URL to validate
 * @param baseUrl - The base URL of the application
 * @returns Validated URL string or null if invalid
 */
export function validateRedirectUrl(url: string, baseUrl: string): string | null {
  if (!url || !baseUrl) {
    return null
  }
  
  try {
    const redirectUrl = new URL(url, baseUrl)
    const base = new URL(baseUrl)
    
    // Must be same origin
    if (redirectUrl.origin !== base.origin) {
      return null
    }
    
    // Must be in allowed paths
    const isValidPath = ALLOWED_REDIRECT_PATHS.some(path => 
      redirectUrl.pathname === path || redirectUrl.pathname.startsWith(path + '/')
    )
    
    if (!isValidPath) {
      return null
    }
    
    // Check for dangerous protocols
    if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
      return null
    }
    
    return redirectUrl.toString()
  } catch {
    return null
  }
}

/**
 * Get a safe default redirect URL
 */
export function getDefaultRedirectUrl(baseUrl: string): string {
  try {
    return new URL('/select-dashboard', baseUrl).toString()
  } catch {
    return '/select-dashboard'
  }
}
