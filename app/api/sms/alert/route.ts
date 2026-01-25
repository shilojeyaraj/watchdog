import { NextRequest, NextResponse } from 'next/server';
import { initializeState, updateDangerLevel, shouldTriggerAlert, isThrottled, recordAlertSent } from '@/app/sms/smsState';
import { sendInitialAlertSMS } from '@/app/sms/automated_message';
import { sendAlertToUser, isInCooldown, getCooldownRemaining } from '@/lib/twilio';

export async function POST(request: NextRequest) {
  console.log('[SMS ALERT API] ====== REQUEST RECEIVED ======');
  
  try {
    // Initialize state on first run
    initializeState();

    const body = await request.json();
    const { dangerLevel, description, clerkId } = body;

    console.log('[SMS ALERT API] Danger level:', dangerLevel);
    console.log('[SMS ALERT API] Description:', description);
    console.log('[SMS ALERT API] Clerk ID:', clerkId || 'NOT PROVIDED');

    // Validate input
    if (!dangerLevel || !['SAFE', 'WARNING', 'DANGER'].includes(dangerLevel)) {
      console.log('[SMS ALERT API] ❌ Invalid danger level');
      return NextResponse.json(
        { error: 'Invalid or missing dangerLevel' },
        { status: 400 }
      );
    }

    // Require clerkId for user-specific alerts
    if (!clerkId) {
      console.log('[SMS ALERT API] ❌ No clerkId provided');
      return NextResponse.json(
        { error: 'clerkId is required to send alerts to the logged-in user' },
        { status: 400 }
      );
    }

    // Update the consecutive danger count
    const consecutiveCount = updateDangerLevel(dangerLevel);
    console.log(`[SMS ALERT API] Consecutive count: ${consecutiveCount}`);

    // Check if we should send an alert
    const shouldAlert = shouldTriggerAlert();
    const throttled = isThrottled();
    
    console.log(`[SMS ALERT API] Should trigger: ${shouldAlert}, Throttled: ${throttled}`);

    if (shouldAlert && !throttled) {
      try {
        // Check Twilio cooldown first
        if (isInCooldown()) {
          const remaining = getCooldownRemaining();
          console.log(`[SMS ALERT API] Twilio cooldown active - ${remaining}s remaining`);
          return NextResponse.json(
            {
              success: false,
              message: `SMS cooldown active - ${remaining}s remaining`,
              consecutiveCount,
              throttled: true,
            },
            { status: 429 }
          );
        }
        
        // Build the alert message
        const alertMessage = `🚨 WATCHDOG ALERT 🚨\n\n` +
          `Threat Level: ${dangerLevel}\n\n` +
          `${description || 'Potential threat detected'}\n\n` +
          `Time: ${new Date().toLocaleString()}\n\n` +
          `Reply:\n"1" - More details\n"2" - View image`;
        
        console.log('[SMS ALERT API] Sending alert to user:', clerkId);
        
        // Send alert to the specific logged-in user
        const result = await sendAlertToUser(
          clerkId,
          dangerLevel as 'WARNING' | 'DANGER',
          alertMessage
        );
        
        console.log('[SMS ALERT API] Result:', result);
        
        // Record in legacy system for backwards compatibility
        if (result.sent > 0) {
          recordAlertSent(dangerLevel, description, 'initial');
        }
        
        return NextResponse.json(
          {
            success: result.sent > 0,
            message: result.sent > 0 
              ? `Alert sent to ${result.displayName || 'user'}` 
              : result.reason || 'Alert not sent',
            consecutiveCount,
            result
          },
          { status: result.sent > 0 ? 200 : 200 } // 200 even if not sent (user preference)
        );
      } catch (error) {
        console.error('[SMS ALERT API] Failed to send SMS:', error);
        return NextResponse.json(
          { error: 'Failed to send SMS', details: (error as Error).message },
          { status: 500 }
        );
      }
    } else if (shouldAlert && throttled) {
      console.log('[SMS ALERT API] Alert throttled by smsState');
      return NextResponse.json(
        {
          success: false,
          message: 'Alert throttled - will not send another alert within 1 minute',
          consecutiveCount,
          throttled: true,
        },
        { status: 429 }
      );
    } else {
      console.log(`[SMS ALERT API] No alert needed - count ${consecutiveCount} < 3`);
      return NextResponse.json(
        {
          success: false,
          message: 'Not enough consecutive DANGER events to trigger alert',
          consecutiveCount,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('[SMS ALERT API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
