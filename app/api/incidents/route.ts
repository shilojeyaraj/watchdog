import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/lib/db-users';
import { getAllIncidents, getOpenIncidents, getIncidentsByUserId } from '@/lib/db-incidents';

/**
 * GET /api/incidents
 * Load all incidents for the authenticated user
 * Query params:
 * - status: Filter by status (open, acknowledged, responding, resolved, false_alarm)
 * - priority: Filter by priority (low, medium, high, critical)
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
    const status = searchParams.get('status') as 'open' | 'acknowledged' | 'responding' | 'resolved' | 'false_alarm' | null;
    const priority = searchParams.get('priority') as 'low' | 'medium' | 'high' | 'critical' | null;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    // Get incidents
    const incidents = await getIncidentsByUserId(user.id, {
      status: status || undefined,
      priority: priority || undefined,
      limit,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      incidents,
      count: incidents.length,
    });
  } catch (error) {
    console.error('[Incidents API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load incidents', details: (error as Error).message },
      { status: 500 }
    );
  }
}
