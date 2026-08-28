/**
 * Centralized Error Handling
 * 
 * Custom error classes and error handling utilities
 * for consistent error responses across the application.
 */

import { NextResponse } from 'next/server'
import { logger } from './logger'

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(message, 401, 'AUTH_REQUIRED', details)
    this.name = 'AuthenticationError'
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', details?: any) {
    super(message, 403, 'FORBIDDEN', details)
    this.name = 'AuthorizationError'
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(message, 404, 'NOT_FOUND', details)
    this.name = 'NotFoundError'
  }
}

/**
 * Handle API errors and return appropriate response
 */
export function handleApiError(
  error: unknown,
  context?: Record<string, any>
): NextResponse {
  const isAppError = error instanceof AppError
  
  // Log error
  if (isAppError) {
    logger.error(error.message, {
      ...context,
      errorCode: error.code,
      statusCode: error.statusCode,
      details: error.details,
    })
  } else {
    logger.error('Unhandled error', {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    })
  }
  
  // Return appropriate response
  if (isAppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(process.env.NODE_ENV === 'development' && {
          details: error.details,
        }),
      },
      { status: error.statusCode }
    )
  }
  
  // Unknown error - don't expose details in production
  return NextResponse.json(
    {
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && {
        details: error instanceof Error ? error.message : String(error),
      }),
    },
    { status: 500 }
  )
}
