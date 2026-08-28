/**
 * External Database Test API
 * 
 * GET /api/external/test - Test connection to external database
 */

import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/external-db';

export async function GET() {
  try {
    const isConnected = await testConnection();

    if (isConnected) {
      return NextResponse.json({
        success: true,
        message: 'External database connection successful',
        status: 'connected',
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'External database connection failed',
        status: 'disconnected',
      }, { status: 503 });
    }
  } catch (error) {
    console.error('[API] External database test error:', error);
    
    // Check if it's a configuration error
    if (error instanceof Error && error.message.includes('EXTERNAL_DATABASE_URL')) {
      return NextResponse.json({
        success: false,
        message: 'EXTERNAL_DATABASE_URL is not configured',
        status: 'not_configured',
        hint: 'Add EXTERNAL_DATABASE_URL to your .env file',
      }, { status: 503 });
    }

    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      status: 'error',
    }, { status: 500 });
  }
}



