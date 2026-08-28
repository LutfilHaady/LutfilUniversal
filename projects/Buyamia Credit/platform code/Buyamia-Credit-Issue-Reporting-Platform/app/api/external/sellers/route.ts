/**
 * External Sellers API
 * 
 * GET /api/external/sellers - List sellers from Buyamia database
 * GET /api/external/sellers?search=term - Search sellers
 * GET /api/external/sellers?topRated=true - Get top rated sellers
 */

import { NextRequest, NextResponse } from 'next/server';
import { externalDb } from '@/lib/external-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const topRated = searchParams.get('topRated') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || undefined;

    let sellers;

    if (search) {
      // Search sellers by name, email, or phone
      sellers = await externalDb.sellers.searchSellers(search, limit);
    } else if (topRated) {
      // Get top rated sellers
      sellers = await externalDb.sellers.getTopRatedSellers(limit);
    } else {
      // Get all sellers with pagination
      sellers = await externalDb.sellers.getAllSellers({ limit, offset, status });
    }

    return NextResponse.json({
      success: true,
      data: sellers,
      count: sellers.length,
      pagination: {
        limit,
        offset,
        hasMore: sellers.length === limit,
      },
    });
  } catch (error) {
    console.error('[API] External sellers error:', error);
    
    // Check if it's a connection error
    if (error instanceof Error && error.message.includes('EXTERNAL_DATABASE_URL')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'External database not configured',
          message: 'Please set EXTERNAL_DATABASE_URL in your environment variables',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch sellers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



