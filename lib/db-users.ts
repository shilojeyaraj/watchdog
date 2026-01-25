// Database utilities for user management and Clerk sync
import { query } from './db';

export interface UserData {
  clerk_id: string;
  email: string;
  phone_number?: string;
  display_name?: string;
}

/**
 * Sync user from Clerk to database
 * Creates user if doesn't exist, updates if exists
 */
export async function syncUserFromClerk(userData: UserData): Promise<string> {
  const { clerk_id, email, phone_number, display_name } = userData;

  // Check if user exists
  const existingUser = await query<{ id: string }>(
    'SELECT id FROM users WHERE clerk_id = $1',
    [clerk_id]
  );

  if (existingUser.rows.length > 0) {
    // Update existing user
    const userId = existingUser.rows[0].id;
    
    await query(
      `UPDATE users 
       SET email = $1, 
           phone_number = COALESCE($2, phone_number),
           display_name = COALESCE($3, display_name),
           last_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $4`,
      [email, phone_number || null, display_name || null, userId]
    );

    return userId;
  } else {
    // Create new user
    const result = await query<{ id: string }>(
      `INSERT INTO users (clerk_id, email, phone_number, display_name, last_login_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [clerk_id, email, phone_number || null, display_name || null]
    );

    return result.rows[0].id;
  }
}

/**
 * Get user by Clerk ID
 */
export async function getUserByClerkId(clerkId: string) {
  const result = await query<{
    id: string;
    clerk_id: string;
    email: string;
    phone_number: string | null;
    display_name: string | null;
    sms_alerts_enabled: boolean;
    email_alerts_enabled: boolean;
    alert_threshold: string;
    created_at: Date;
    last_login_at: Date | null;
  }>(
    'SELECT * FROM users WHERE clerk_id = $1',
    [clerkId]
  );

  return result.rows[0] || null;
}

/**
 * Get user by database ID
 */
export async function getUserById(userId: string) {
  const result = await query<{
    id: string;
    clerk_id: string;
    email: string;
    phone_number: string | null;
    display_name: string | null;
    sms_alerts_enabled: boolean;
    email_alerts_enabled: boolean;
    alert_threshold: string;
    created_at: Date;
    last_login_at: Date | null;
  }>(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  preferences: {
    sms_alerts_enabled?: boolean;
    email_alerts_enabled?: boolean;
    alert_threshold?: 'WARNING' | 'DANGER';
    phone_number?: string;
  }
) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (preferences.sms_alerts_enabled !== undefined) {
    updates.push(`sms_alerts_enabled = $${paramCount++}`);
    values.push(preferences.sms_alerts_enabled);
  }

  if (preferences.email_alerts_enabled !== undefined) {
    updates.push(`email_alerts_enabled = $${paramCount++}`);
    values.push(preferences.email_alerts_enabled);
  }

  if (preferences.alert_threshold !== undefined) {
    updates.push(`alert_threshold = $${paramCount++}`);
    values.push(preferences.alert_threshold);
  }

  if (preferences.phone_number !== undefined) {
    updates.push(`phone_number = $${paramCount++}`);
    values.push(preferences.phone_number);
  }

  if (updates.length === 0) {
    return;
  }

  updates.push(`updated_at = NOW()`);
  values.push(userId);

  await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
    values
  );
}
