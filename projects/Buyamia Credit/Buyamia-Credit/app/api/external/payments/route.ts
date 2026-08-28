/**
 * External Payments API
 * 
 * GET /api/external/payments?overdue=true - Get overdue payments
 * GET /api/external/payments?upcoming=true&days=7 - Get upcoming payments
 * GET /api/external/payments?quoteId=uuid - Get milestones for a quote
 */

import { NextRequest, NextResponse } from 'next/server';
import { externalDb } from '@/lib/external-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const overdue = searchParams.get('overdue') === 'true';
    const upcoming = searchParams.get('upcoming') === 'true';
    const quoteId = searchParams.get('quoteId');
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '50');

    let payments;

    if (quoteId) {
      // Get milestones for a specific quote
      payments = await externalDb.orders.getQuoteMilestones(quoteId);
    } else if (overdue) {
      // Get overdue payment milestones
      payments = await externalDb.orders.getOverduePayments(limit);
    } else if (upcoming) {
      // Get upcoming payment milestones
      payments = await externalDb.orders.getUpcomingPayments(days, limit);
    } else {
      // Default: get both overdue and upcoming
      const [overduePayments, upcomingPayments] = await Promise.all([
        externalDb.orders.getOverduePayments(limit),
        externalDb.orders.getUpcomingPayments(days, limit),
      ]);
      
      return NextResponse.json({
        success: true,
        data: {
          overdue: overduePayments,
          upcoming: upcomingPayments,
        },
        summary: {
          overdueCount: overduePayments.length,
          upcomingCount: upcomingPayments.length,
          totalOverdueAmount: overduePayments.reduce((sum, p) => sum + p.amount, 0),
          totalUpcomingAmount: upcomingPayments.reduce((sum, p) => sum + p.amount, 0),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error) {
    console.error('[API] External payments error:', error);
    
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
        error: 'Failed to fetch payments',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}



