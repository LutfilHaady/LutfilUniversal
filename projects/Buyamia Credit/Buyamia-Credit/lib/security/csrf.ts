/**
 * CSRF Protection with State Tokens
 * 
 * Implements state parameter validation to prevent CSRF attacks
 * during cross-domain authentication redirects.
 */

import { randomBytes } from 'crypto'

// Store state tokens temporarily
// In production, use Redis or database for distributed systems
interface StateToken {
  expiresAt: number
  redirectTo: string
  createdAt: number
}

const stateTokens = new Map<string, StateToken>()

// Clean up expired tokens every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [token, data] of stateTokens.entries()) {
      if (data.expiresAt < now) {
        stateTokens.delete(token)
      }
    }
  }, 5 * 60 * 1000) // 5 minutes
}

/**
 * Generate a state token for CSRF protection
 * 
 * @param redirectTo - The URL to redirect to after authentication
 * @returns State token string
 */
export function generateStateToken(redirectTo: string): string {
  const token = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes
  
  stateTokens.set(token, {
    expiresAt,
    redirectTo,
    createdAt: Date.now(),
  })
  
  return token
}

/**
 * Validate and consume a state token
 * 
 * @param token - The state token to validate
 * @returns Validation result with redirect URL if valid
 */
export function validateStateToken(token: string): { 
  valid: boolean
  redirectTo?: string
} {
  if (!token) {
    return { valid: false }
  }
  
  const state = stateTokens.get(token)
  
  if (!state) {
    return { valid: false }
  }
  
  // Check expiration
  if (state.expiresAt < Date.now()) {
    stateTokens.delete(token)
    return { valid: false }
  }
  
  // Delete token after use (one-time use)
  const redirectTo = state.redirectTo
  stateTokens.delete(token)
  
  return { valid: true, redirectTo }
}

/**
 * Clean up expired tokens manually (for testing or manual cleanup)
 */
export function cleanupExpiredTokens(): number {
  const now = Date.now()
  let cleaned = 0
  
  for (const [token, data] of stateTokens.entries()) {
    if (data.expiresAt < now) {
      stateTokens.delete(token)
      cleaned++
    }
  }
  
  return cleaned
}

/**
 * Get statistics about state tokens (for monitoring)
 */
export function getStateTokenStats() {
  const now = Date.now()
  let active = 0
  let expired = 0
  
  for (const [, data] of stateTokens.entries()) {
    if (data.expiresAt < now) {
      expired++
    } else {
      active++
    }
  }
  
  return {
    total: stateTokens.size,
    active,
    expired,
  }
}
