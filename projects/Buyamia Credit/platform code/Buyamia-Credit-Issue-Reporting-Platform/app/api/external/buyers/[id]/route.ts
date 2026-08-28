/**
 * External Buyer by ID API
 * 
 * GET /api/external/buyers/:id - Get a single buyer by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { externalDb } from '@/lib/external-db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const buyer = await externalDb.buyers.getBuyerById(id);

    if (!buyer) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Buyer not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: buyer,
    });
  } catch (error) {
    console.error('[API] External buyer by ID error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch buyer',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



