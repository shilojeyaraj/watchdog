import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/lib/db-users';
import { getEventsByUserId } from '@/lib/db-events';
import type { EventType, EventSeverity } from '@/lib/db-events';

/**
 * GET /api/events
 * Load all events for the authenticated user
 * Query params:
 * - event_type: Filter by event type (danger_detected, warning_detected, alert_sent, etc.)
 * - severity: Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
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
    const eventType = searchParams.get('event_type') as EventType | null;
    const severity = searchParams.get('severity') as EventSeverity | null;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    // Get events
    const events = await getEventsByUserId(user.id, {
      event_type: eventType || undefined,
      severity: severity || undefined,
      limit,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error) {
    console.error('[Events API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load events', details: (error as Error).message },
      { status: 500 }
    );
  }
}
