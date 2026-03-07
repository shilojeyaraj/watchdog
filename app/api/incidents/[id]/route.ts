import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/lib/db-users';
import { getIncidentById, updateIncidentStatus } from '@/lib/db-incidents';

/**
 * GET /api/incidents/[id]
 * Get a specific incident by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const incident = await getIncidentById(id);

    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    // Verify user owns this incident
    if (incident.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      incident,
    });
  } catch (error) {
    console.error('[Incident API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load incident', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/incidents/[id]
 * Update incident status
 * Body: { status: 'open' | 'acknowledged' | 'responding' | 'resolved' | 'false_alarm', resolutionNotes?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const incident = await getIncidentById(id);

    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    // Verify user owns this incident
    if (incident.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, resolutionNotes } = body;

    if (!status || !['open', 'acknowledged', 'responding', 'resolved', 'false_alarm'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    await updateIncidentStatus(id, status, resolutionNotes);

    const updatedIncident = await getIncidentById(id);

    return NextResponse.json({
      success: true,
      incident: updatedIncident,
    });
  } catch (error) {
    console.error('[Incident API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update incident', details: (error as Error).message },
      { status: 500 }
    );
  }
}
