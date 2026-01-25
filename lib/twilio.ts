// Twilio SMS Service - User-Specific Alerts
// Sends alerts to the currently logged-in user from Neon database
// Only sends if user has sms_alerts_enabled=true and phone_number set

import twilio from 'twilio';
import { query } from './db';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

// Cooldown: 1 minute between alerts globally
const ALERT_COOLDOWN_MS = 60 * 1000;
let lastAlertTime = 0;

// Create Twilio client (only if credentials are available)
let client: twilio.Twilio | null = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
  console.log('[TWILIO] Client initialized successfully');
} else {
  console.warn('[TWILIO] Credentials not set - SMS sending disabled');
}

// User type from database
interface AlertUser {
  id: string;
  clerk_id: string;
  display_name: string | null;
  phone_number: string;
  email: string;
  sms_alerts_enabled: boolean;
  alert_threshold: 'WARNING' | 'DANGER';
}

// Result type for alert operations
export interface AlertResult {
  sent: number;
  failed: number;
  userId?: string;
  displayName?: string | null;
  phoneNumber?: string;
  twilioSid?: string;
  reason?: string;
  error?: string;
}

/**
 * Send SMS alert to a specific user by their Clerk ID
 * Only sends if user has sms_alerts_enabled = true and has a phone number
 * 
 * @param clerkId - The Clerk user ID (e.g., "user_2abc123")
 * @param severity - The alert severity level
 * @param message - The SMS message to send
 */
export async function sendAlertToUser(
  clerkId: string,
  severity: 'WARNING' | 'DANGER',
  message: string
): Promise<AlertResult> {
  // ...existing code...

  // Check if Twilio client is ready
  if (!client) {
    return {
      sent: 0,
      failed: 1,
      reason: 'Twilio client not initialized'
    };
  }

  // Check global cooldown
  const now = Date.now();
  const timeSinceLastAlert = now - lastAlertTime;
  if (lastAlertTime > 0 && timeSinceLastAlert < ALERT_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((ALERT_COOLDOWN_MS - timeSinceLastAlert) / 1000);
    return {
      sent: 0,
      failed: 0,
      reason: `Cooldown active - ${remainingSeconds}s remaining`
    };
  }

  try {
    // Query the specific user from database by clerk_id
    
    const result = await query<AlertUser>(
      `SELECT id, clerk_id, display_name, phone_number, email, sms_alerts_enabled, alert_threshold
       FROM users
       WHERE clerk_id = $1
       LIMIT 1`,
      [clerkId]
    );


    if (result.rows.length === 0) {
      return {
        sent: 0,
        failed: 0,
        reason: 'User not found in database'
      };
    }

    const user = result.rows[0];

    // Check if SMS is enabled for this user
    if (!user.sms_alerts_enabled) {
      return {
        sent: 0,
        failed: 0,
        userId: user.id,
        displayName: user.display_name,
        reason: 'SMS alerts disabled for this user'
      };
    }

    // Check if user has a phone number
    if (!user.phone_number) {
      return {
        sent: 0,
        failed: 0,
        userId: user.id,
        displayName: user.display_name,
        reason: 'No phone number configured'
      };
    }

    // Check severity threshold
    if (user.alert_threshold === 'DANGER' && severity === 'WARNING') {
      return {
        sent: 0,
        failed: 0,
        userId: user.id,
        displayName: user.display_name,
        reason: 'Alert severity below user threshold'
      };
    }

    // Send the SMS

    const messageResult = await client.messages.create({
      body: message,
      from: twilioFromNumber,
      to: user.phone_number
    });

    // Single detailed log after SMS is sent
    const timestamp = new Date().toISOString();
    console.log(`[SMS SENT] ${timestamp} | ClerkID: ${user.clerk_id} | Name: ${user.display_name || user.email} | Phone: ${user.phone_number} | SID: ${messageResult.sid} | Status: ${messageResult.status} | Message: ${message}`);

    // Update last alert time
    lastAlertTime = now;


    return {
      sent: 1,
      failed: 0,
      userId: user.id,
      displayName: user.display_name,
      phoneNumber: user.phone_number,
      twilioSid: messageResult.sid
    };

  } catch (error) {
    const timestamp = new Date().toISOString();
    console.log(`[SMS ERROR] ${timestamp} | ClerkID: ${clerkId} | Error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      sent: 0,
      failed: 1,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send SMS directly to a phone number (bypasses user lookup)
 * Use for testing or admin alerts
 */
export async function sendDirectSMS(
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  // ...existing code...

  if (!client) {
    return { success: false, error: 'Twilio client not initialized' };
  }

  try {
    const message = await client.messages.create({
      body,
      from: twilioFromNumber,
      to
    });

    const timestamp = new Date().toISOString();
    console.log(`[SMS SENT] ${timestamp} | Phone: ${to} | SID: ${message.sid} | Status: ${message.status} | Message: ${body}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.log(`[SMS ERROR] ${timestamp} | Phone: ${to} | Error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if global cooldown is currently active
 */
export function isInCooldown(): boolean {
  const timeSinceLastAlert = Date.now() - lastAlertTime;
  return lastAlertTime > 0 && timeSinceLastAlert < ALERT_COOLDOWN_MS;
}

/**
 * Get time remaining in cooldown (in seconds)
 */
export function getCooldownRemaining(): number {
  if (!isInCooldown()) return 0;
  return Math.ceil((ALERT_COOLDOWN_MS - (Date.now() - lastAlertTime)) / 1000);
}

// Export the Twilio client for advanced usage
export { client as twilioClient };
