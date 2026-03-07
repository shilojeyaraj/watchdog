import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/lib/db-users';
import { getOpenIncidents } from '@/lib/db-incidents';

/**
 * GET /api/incidents/open
 * Load all open incidents for the authenticated user
 * Query params:
 * - limit: Number of results (default: 100)
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

    // Get open incidents
    const incidents = await getOpenIncidents(user.id, limit);

    return NextResponse.json({
      success: true,
      incidents,
      count: incidents.length,
    });
  } catch (error) {
    console.error('[Open Incidents API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load open incidents', details: (error as Error).message },
      { status: 500 }
    );
  }
}
