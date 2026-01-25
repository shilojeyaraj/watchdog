// Database query helper for users
// Provides functions to fetch user data from Neon PostgreSQL for SMS alerts

import { query } from './db';

export interface UserAlertSettings {
  id: string;
  clerk_id: string;
  email: string;
  phone_number: string | null;
  display_name: string | null;
  sms_alerts_enabled: boolean;
  email_alerts_enabled: boolean;
  alert_threshold: 'WARNING' | 'DANGER';
}

/**
 * Get user by Clerk ID with alert preferences
 */
export async function getUserByClerkId(clerkId: string): Promise<UserAlertSettings | null> {
  console.log('[DB USERS] Fetching user by clerk_id:', clerkId);
  
  const result = await query<UserAlertSettings>(
    `SELECT 
      id,
      clerk_id,
      email,
      phone_number,
      display_name,
      sms_alerts_enabled,
      email_alerts_enabled,
      alert_threshold
    FROM users
    WHERE clerk_id = $1
    LIMIT 1`,
    [clerkId]
  );
  
  if (result.rows.length === 0) {
    console.log('[DB USERS] User not found for clerk_id:', clerkId);
    return null;
  }
  
  console.log('[DB USERS] Found user:', result.rows[0].id);
  return result.rows[0];
}

/**
 * Get user by internal UUID
 */
export async function getUserById(userId: string): Promise<UserAlertSettings | null> {
  console.log('[DB USERS] Fetching user by id:', userId);
  
  const result = await query<UserAlertSettings>(
    `SELECT 
      id,
      clerk_id,
      email,
      phone_number,
      display_name,
      sms_alerts_enabled,
      email_alerts_enabled,
      alert_threshold
    FROM users
    WHERE id = $1
    LIMIT 1`,
    [userId]
  );
  
  if (result.rows.length === 0) {
    console.log('[DB USERS] User not found for id:', userId);
    return null;
  }
  
  console.log('[DB USERS] Found user:', result.rows[0].id);
  return result.rows[0];
}

/**
 * Get all users who should receive alerts for a given severity
 * Filters by:
 * - sms_alerts_enabled = true
 * - phone_number is not null
 * - alert_threshold matches severity (DANGER always triggers, WARNING only if threshold is WARNING)
 */
export async function getUsersForAlert(severity: 'WARNING' | 'DANGER'): Promise<UserAlertSettings[]> {
  console.log('[DB USERS] Fetching users for alert severity:', severity);
  
  // If severity is DANGER, get all users with SMS enabled
  // If severity is WARNING, only get users with threshold set to WARNING
  const result = await query<UserAlertSettings>(
    `SELECT 
      id,
      clerk_id,
      email,
      phone_number,
      display_name,
      sms_alerts_enabled,
      email_alerts_enabled,
      alert_threshold
    FROM users
    WHERE sms_alerts_enabled = true
      AND phone_number IS NOT NULL
      AND (
        alert_threshold = 'WARNING'
        OR ($1 = 'DANGER')
      )`,
    [severity]
  );
  
  console.log('[DB USERS] Found', result.rows.length, 'users for alert');
  return result.rows;
}

/**
 * Get all users with SMS alerts enabled (regardless of threshold)
 */
export async function getAllSmsEnabledUsers(): Promise<UserAlertSettings[]> {
  console.log('[DB USERS] Fetching all SMS-enabled users');
  
  const result = await query<UserAlertSettings>(
    `SELECT 
      id,
      clerk_id,
      email,
      phone_number,
      display_name,
      sms_alerts_enabled,
      email_alerts_enabled,
      alert_threshold
    FROM users
    WHERE sms_alerts_enabled = true
      AND phone_number IS NOT NULL`
  );
  
  console.log('[DB USERS] Found', result.rows.length, 'SMS-enabled users');
  return result.rows;
}

/**
 * Update user's phone number
 */
export async function updateUserPhoneNumber(userId: string, phoneNumber: string): Promise<boolean> {
  console.log('[DB USERS] Updating phone number for user:', userId);
  
  const result = await query(
    `UPDATE users 
    SET phone_number = $1, updated_at = NOW()
    WHERE id = $2`,
    [phoneNumber, userId]
  );
  
  const success = result.rowCount > 0;
  console.log('[DB USERS] Phone number update:', success ? 'success' : 'failed');
  return success;
}

/**
 * Update user's alert preferences
 */
export async function updateUserAlertPreferences(
  userId: string,
  preferences: {
    sms_alerts_enabled?: boolean;
    email_alerts_enabled?: boolean;
    alert_threshold?: 'WARNING' | 'DANGER';
  }
): Promise<boolean> {
  console.log('[DB USERS] Updating alert preferences for user:', userId, preferences);
  
  const updates: string[] = [];
  const values: (string | boolean)[] = [];
  let paramIndex = 1;
  
  if (preferences.sms_alerts_enabled !== undefined) {
    updates.push(`sms_alerts_enabled = $${paramIndex++}`);
    values.push(preferences.sms_alerts_enabled);
  }
  if (preferences.email_alerts_enabled !== undefined) {
    updates.push(`email_alerts_enabled = $${paramIndex++}`);
    values.push(preferences.email_alerts_enabled);
  }
  if (preferences.alert_threshold !== undefined) {
    updates.push(`alert_threshold = $${paramIndex++}`);
    values.push(preferences.alert_threshold);
  }
  
  if (updates.length === 0) {
    console.log('[DB USERS] No preferences to update');
    return true;
  }
  
  updates.push('updated_at = NOW()');
  values.push(userId);
  
  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
  
  const success = result.rowCount > 0;
  console.log('[DB USERS] Preferences update:', success ? 'success' : 'failed');
  return success;
}
