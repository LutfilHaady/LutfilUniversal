/**
 * External Orders API
 * 
 * GET /api/external/orders - List orders from Buyamia database
 * GET /api/external/orders?buyerId=uuid - Filter by buyer
 * GET /api/external/orders?sellerId=uuid - Filter by seller
 * GET /api/external/orders?pendingPayment=true - Get orders pending payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { externalDb } from '@/lib/external-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buyerId = searchParams.get('buyerId') || undefined;
    const sellerId = searchParams.get('sellerId') || undefined;
    const status = searchParams.get('status') || undefined;
    const paymentStatus = searchParams.get('paymentStatus') || undefined;
    const pendingPayment = searchParams.get('pendingPayment') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let orders;

    if (pendingPayment) {
      // Get orders pending payment (for collections)
      orders = await externalDb.orders.getPendingPaymentOrders(limit);
    } else {
      // Get orders with filters
      orders = await externalDb.orders.getOrders({
        buyerId,
        sellerId,
        status,
        paymentStatus,
        limit,
        offset,
      });
    }

    return NextResponse.json({
      success: true,
      data: orders,
      count: orders.length,
      pagination: {
        limit,
        offset,
        hasMore: orders.length === limit,
      },
    });
  } catch (error) {
    console.error('[API] External orders error:', error);
    
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
        error: 'Failed to fetch orders',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



