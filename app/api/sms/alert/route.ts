import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { initializeState, updateDangerLevel, updateIncidentCount, shouldTriggerAlert, shouldCreateIncident, isThrottled, recordAlertSent, resetIncidentCount } from '@/app/sms/smsState';
import { sendInitialAlertSMS } from '@/app/sms/automated_message';
import { createDangerDetectionEvent } from '@/lib/db-events';
import { createIncidentFromEvent } from '@/lib/db-incidents';
import { getUserByClerkId } from '@/lib/db-users';
import { shouldThrottleEvent } from '@/lib/db-event-throttle';

export async function POST(request: NextRequest) {
  try {
    // Initialize state on first run
    initializeState();

    // Get authenticated user (optional - events can be stored without user)
    let userId: string | null = null;
    try {
      const { userId: clerkId } = await auth();
      if (clerkId) {
        const user = await getUserByClerkId(clerkId);
        userId = user?.id || null;
      }
    } catch (error) {
      // Auth is optional for this endpoint
      console.log('[SMS Alert API] No authenticated user, storing as system event');
    }

    const body = await request.json();
    const { dangerLevel, description, personGrid, section, cameraId } = body;

    // Validate input
    if (!dangerLevel || !['SAFE', 'WARNING', 'DANGER'].includes(dangerLevel)) {
      return NextResponse.json(
        { error: 'Invalid or missing dangerLevel' },
        { status: 400 }
      );
    }

    // Update the consecutive danger count (for SMS alerts - requires 3)
    const consecutiveCount = updateDangerLevel(dangerLevel);

    // Update consecutive incident count (for incident creation - requires 4)
    const consecutiveIncidentCount = updateIncidentCount(dangerLevel);

    console.log(
      `[SMS Alert API] Danger level: ${dangerLevel}, Consecutive count: ${consecutiveCount}, Incident count: ${consecutiveIncidentCount}`
    );

    // Store event in database (for WARNING and DANGER only) with throttling
    let eventId: string | null = null;
    if (dangerLevel !== 'SAFE') {
      // Check if we should throttle event storage (15 second interval)
      const throttleCheck = shouldThrottleEvent(dangerLevel, {
        section: section || undefined,
        cameraId: cameraId || 'default',
      });

      if (!throttleCheck.throttle) {
        try {
          eventId = await createDangerDetectionEvent(dangerLevel, description || '', {
            user_id: userId,
            camera_id: cameraId || 'default',
            section: section || undefined,
            personGrid: personGrid || undefined,
            consecutiveCount,
          });
          console.log(`[SMS Alert API] Event stored: ${eventId} (reason: ${throttleCheck.reason || 'normal'})`);
        } catch (error) {
          console.error('[SMS Alert API] Failed to store event:', error);
          // Continue even if event storage fails
        }
      } else {
        console.log(`[SMS Alert API] Event throttled: ${throttleCheck.reason}`);
      }
    }

    // Create incident independently of SMS alerts (requires 4 consecutive detections)
    // This can happen even if SMS is throttled or if we have WARNING (not DANGER)
    let incidentId: string | null = null;
    if (shouldCreateIncident() && eventId && (dangerLevel === 'DANGER' || dangerLevel === 'WARNING')) {
      try {
        incidentId = await createIncidentFromEvent(
          eventId,
          dangerLevel as 'WARNING' | 'DANGER',
          description || '',
          {
            user_id: userId,
            camera_id: cameraId || 'default',
          }
        );
        console.log(`[SMS Alert API] Incident created: ${incidentId} (after ${consecutiveIncidentCount} consecutive detections)`);
        
        // Reset incident count after creating incident to prevent duplicate incidents
        // This ensures we need another 4 consecutive detections before creating a new incident
        resetIncidentCount();
      } catch (error) {
        console.error('[SMS Alert API] Failed to create incident:', error);
        // Continue even if incident creation fails
      }
    } else if (dangerLevel === 'DANGER' || dangerLevel === 'WARNING') {
      console.log(`[SMS Alert API] Incident not created yet - need 4 consecutive detections (current: ${consecutiveIncidentCount})`);
    }

    // Check if we should send an alert (SMS requires 3 consecutive DANGER events)
    if (shouldTriggerAlert() && !isThrottled()) {
      try {
        // Send the initial alert SMS
        await sendInitialAlertSMS(dangerLevel, description);

        // Record that we sent an alert
        recordAlertSent(dangerLevel, description, 'initial');

        return NextResponse.json(
          {
            success: true,
            message: 'Alert sent successfully',
            consecutiveCount,
            consecutiveIncidentCount,
            eventId,
            incidentId,
          },
          { status: 200 }
        );
      } catch (error) {
        console.error('[SMS Alert API] Failed to send SMS:', error);
        return NextResponse.json(
          { error: 'Failed to send SMS', details: (error as Error).message },
          { status: 500 }
        );
      }
    } else if (shouldTriggerAlert() && isThrottled()) {
      console.log('[SMS Alert API] Alert throttled - last alert sent less than 1 minute ago');
      return NextResponse.json(
        {
          success: false,
          message: 'Alert throttled - will not send another alert within 1 minute',
          consecutiveCount,
          consecutiveIncidentCount,
          throttled: true,
          eventId,
        },
        { status: 429 } // Too Many Requests
      );
    } else {
      console.log(
        `[SMS Alert API] No alert needed - consecutive count (${consecutiveCount}) < 3`
      );
      return NextResponse.json(
        {
          success: false,
          message: 'Not enough consecutive DANGER events to trigger alert',
          consecutiveCount,
          consecutiveIncidentCount,
          eventId,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('[SMS Alert API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
