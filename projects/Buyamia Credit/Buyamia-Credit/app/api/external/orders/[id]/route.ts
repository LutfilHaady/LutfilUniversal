/**
 * External Order by ID API
 * 
 * GET /api/external/orders/:id - Get a single order by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { externalDb } from '@/lib/external-db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const order = await externalDb.orders.getOrderById(id);

    if (!order) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Order not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('[API] External order by ID error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



