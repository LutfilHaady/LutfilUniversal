/**
 * External Seller by ID API
 * 
 * GET /api/external/sellers/:id - Get a single seller by ID
 * GET /api/external/sellers/:id?includePerformance=true - Include performance scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { externalDb } from '@/lib/external-db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const includePerformance = searchParams.get('includePerformance') === 'true';

    const seller = await externalDb.sellers.getSellerById(id);

    if (!seller) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Seller not found',
        },
        { status: 404 }
      );
    }

    // Optionally include performance scores
    let performance = null;
    if (includePerformance) {
      performance = await externalDb.sellers.getSellerPerformance(id);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...seller,
        performance,
      },
    });
  } catch (error) {
    console.error('[API] External seller by ID error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch seller',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



