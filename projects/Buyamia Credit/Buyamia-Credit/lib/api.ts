/**
 * API Client Utilities
 * 
 * This file contains helper functions for making API calls.
 * All functions are ready for backend integration - just uncomment and use.
 */

// Base API URL - will be set from environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

/**
 * Generic API fetch wrapper with error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

/**
 * GET request helper
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'GET' })
}

/**
 * POST request helper
 */
export async function apiPost<T>(endpoint: string, data: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * PATCH request helper
 */
export async function apiPatch<T>(endpoint: string, data: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'DELETE' })
}

/**
 * API Endpoints (for reference when backend is ready)
 * 
 * Auth:
 * - POST /api/auth/register - Register new user
 * - POST /api/auth/login - Login user
 * - POST /api/auth/logout - Logout user
 * 
 * Dashboard:
 * - GET /api/dashboard/supplier - Get supplier dashboard data
 * - GET /api/dashboard/buyer - Get buyer dashboard data
 * 
 * Invoices:
 * - GET /api/invoices - List all invoices
 * - GET /api/invoices/:id - Get invoice details
 * - POST /api/invoices - Create new invoice
 * - PATCH /api/invoices/:id/mark-paid - Mark invoice as paid
 * 
 * Issues:
 * - GET /api/issues - List all issues
 * - GET /api/issues/:id - Get issue details
 * - POST /api/issues - Create new issue
 * - PATCH /api/issues/:id/resolve - Resolve issue
 * 
 * Users:
 * - GET /api/users/search?q=:query - Search for user by ID
 * - GET /api/users/:id - Get user profile
 * 
 * Webhooks:
 * - POST /api/webhooks/invoice-created - Webhook from Buyamia for new orders
 */

