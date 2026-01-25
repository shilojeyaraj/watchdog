// Sync Clerk user to Neon database
// Call this on protected pages to ensure user exists in DB

import { currentUser } from '@clerk/nextjs/server';
import { query } from '../db';

/**
 * Sync current authenticated user from Clerk to Neon database
 * Creates user if doesn't exist, updates if exists
 * Returns the internal user ID (UUID)
 */
export async function syncCurrentUser(): Promise<string | null> {
  const user = await currentUser();
  
  if (!user) {
    console.log('[SYNC USER] No authenticated user');
    return null;
  }

  console.log('[SYNC USER] Syncing user:', user.id);

  const email = user.emailAddresses[0]?.emailAddress || '';
  const phone = user.phoneNumbers[0]?.phoneNumber || null;
  const displayName = user.firstName 
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : null;

  // Upsert user - insert or update if exists
  const result = await query<{ id: string }>(
    `INSERT INTO users (id, clerk_id, email, phone_number, display_name)
    VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4)
    ON CONFLICT (clerk_id) DO UPDATE SET
      email = EXCLUDED.email,
      phone_number = COALESCE(EXCLUDED.phone_number, users.phone_number),
      display_name = COALESCE(EXCLUDED.display_name, users.display_name),
      last_login_at = NOW(),
      updated_at = NOW()
    RETURNING id`,
    [user.id, email, phone, displayName]
  );

  const userId = result.rows[0]?.id;
  console.log('[SYNC USER] User synced with id:', userId);
  return userId || null;
}

/**
 * Get internal user ID for a Clerk user ID
 */
export async function getUserIdFromClerk(clerkId: string): Promise<string | null> {
  console.log('[SYNC USER] Looking up user ID for clerk_id:', clerkId);
  
  const result = await query<{ id: string }>(
    `SELECT id FROM users WHERE clerk_id = $1`,
    [clerkId]
  );
  
  if (result.rows.length === 0) {
    console.log('[SYNC USER] User not found');
    return null;
  }
  
  return result.rows[0].id;
}

/**
 * Ensure a user exists in the database by Clerk ID
 * If not exists, creates a minimal record
 */
export async function ensureUserExists(clerkId: string, email: string): Promise<string> {
  console.log('[SYNC USER] Ensuring user exists:', clerkId);
  
  const result = await query<{ id: string }>(
    `INSERT INTO users (id, clerk_id, email)
    VALUES (gen_random_uuid()::TEXT, $1, $2)
    ON CONFLICT (clerk_id) DO UPDATE SET
      updated_at = NOW()
    RETURNING id`,
    [clerkId, email]
  );
  
  const userId = result.rows[0]?.id;
  console.log('[SYNC USER] User ensured with id:', userId);
  return userId;
}
