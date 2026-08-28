/**
 * CORS Configuration
 * 
 * Handles Cross-Origin Resource Sharing headers
 * for secure cross-domain communication with Buyamia.
 */

const ALLOWED_ORIGINS = [
  'https://buyamia.com',
  'https://www.buyamia.com',
  ...(process.env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://localhost:3001'] 
    : []
  ),
]

/**
 * Get CORS headers for a given origin
 * 
 * @param origin - The origin header from the request
 * @returns CORS headers object
 */
export function getCorsHeaders(origin: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
  
  if (origin && ALLOWED_ORIGINS.some(allowed => {
    try {
      const originUrl = new URL(origin)
      const allowedUrl = new URL(allowed)
      return originUrl.hostname === allowedUrl.hostname
    } catch {
      return origin.includes(allowed)
    }
  })) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  
  return headers
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  
  return ALLOWED_ORIGINS.some(allowed => {
    try {
      const originUrl = new URL(origin)
      const allowedUrl = new URL(allowed)
      return originUrl.hostname === allowedUrl.hostname
    } catch {
      return origin.includes(allowed)
    }
  })
}
