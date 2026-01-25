import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/lib/db-users';
import { getWarningEvents, getEventsByUserId } from '@/lib/db-events';

/**
 * GET /api/warnings
 * Load all warning events for the authenticated user
 * Query params:
 * - limit: Number of results (default: 100)
 * - startDate: ISO date string for start date filter
 * - endDate: ISO date string for end date filter
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    // Get warning events
    const warnings = await getEventsByUserId(user.id, {
      event_type: 'warning_detected',
      limit,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      warnings,
      count: warnings.length,
    });
  } catch (error) {
    console.error('[Warnings API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load warnings', details: (error as Error).message },
      { status: 500 }
    );
  }
}
