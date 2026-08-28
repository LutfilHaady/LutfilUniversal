/**
 * Origin Validation for Cross-Domain Security
 * 
 * Validates that requests are coming from legitimate Buyamia domains
 * to prevent unauthorized access to authentication endpoints.
 */

import { NextRequest } from 'next/server'

const ALLOWED_ORIGINS = [
  'https://buyamia.com',
  'https://www.buyamia.com',
  // Add staging if needed
  ...(process.env.NODE_ENV !== 'production' 
    ? ['http://localhost:3000', 'http://localhost:3001'] 
    : []
  ),
]

const BUYAMIA_DOMAINS = ['buyamia.com', 'www.buyamia.com']

/**
 * Validates that the request origin is from an allowed domain
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  
  // Check origin header
  if (origin) {
    try {
      const originUrl = new URL(origin)
      if (ALLOWED_ORIGINS.some(allowed => {
        const allowedUrl = new URL(allowed)
        return originUrl.hostname === allowedUrl.hostname
      })) {
        return true
      }
    } catch {
      // Invalid URL format
      return false
    }
  }
  
  // Check referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      return ALLOWED_ORIGINS.some(allowed => {
        const allowedUrl = new URL(allowed)
        return refererUrl.hostname === allowedUrl.hostname
      })
    } catch {
      return false
    }
  }
  
  return false
}

/**
 * Validates that the request is specifically from Buyamia domains
 */
export function validateBuyamiaOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin') || ''
  const referer = request.headers.get('referer') || ''
  
  return BUYAMIA_DOMAINS.some(domain => 
    origin.includes(domain) || referer.includes(domain)
  )
}

/**
 * Get the origin domain from request (for logging)
 */
export function getOriginDomain(request: NextRequest): string {
  const origin = request.headers.get('origin') || ''
  const referer = request.headers.get('referer') || ''
  
  try {
    if (origin) {
      return new URL(origin).hostname
    }
    if (referer) {
      return new URL(referer).hostname
    }
  } catch {
    // Invalid URL
  }
  
  return 'unknown'
}
