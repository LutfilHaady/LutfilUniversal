/**
 * Rate Limiting
 * 
 * Simple in-memory rate limiting for API endpoints.
 * For production, consider using Redis for distributed rate limiting.
 */

import { LRUCache } from 'lru-cache'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Rate limit store (in-memory)
// In production, use Redis for distributed systems
const rateLimitStore = new LRUCache<string, RateLimitEntry>({
  max: 10000, // Max 10,000 unique IPs/users
  ttl: 60000, // 1 minute default TTL
})

/**
 * Check rate limit for an identifier (IP, userId, etc.)
 * 
 * @param identifier - Unique identifier (IP address, userId, etc.)
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute default
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const key = `${identifier}:${limit}:${windowMs}`
  
  const entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetTime < now) {
    // Create new entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    }
    rateLimitStore.set(key, newEntry)
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: newEntry.resetTime,
    }
  }
  
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetTime,
    }
  }
  
  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)
  
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetTime,
  }
}

/**
 * Get rate limit info without incrementing
 */
export function getRateLimitInfo(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): { remaining: number; resetAt: number } {
  const now = Date.now()
  const key = `${identifier}:${limit}:${windowMs}`
  
  const entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetTime < now) {
    return {
      remaining: limit,
      resetAt: now + windowMs,
    }
  }
  
  return {
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetTime,
  }
}
