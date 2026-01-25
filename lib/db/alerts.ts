// Alert records database helper
// Provides functions to log and query SMS alerts from Neon PostgreSQL

import { query } from '../db';

export interface AlertRecord {
  id: string;
  user_id: string | null;
  phone_number: string;
  message: string;
  twilio_sid: string | null;
  status: 'sent' | 'failed' | 'skipped' | 'cooldown';
  severity: 'WARNING' | 'DANGER';
  camera_id: string | null;
  location_id: string | null;
  timestamp: number;
  created_at: string;
}

/**
 * Log an alert to the database
 */
export async function logAlert(alert: {
  userId: string | null;
  phoneNumber: string;
  message: string;
  twilioSid: string | null;
  status: 'sent' | 'failed' | 'skipped' | 'cooldown';
  severity: 'WARNING' | 'DANGER';
  cameraId?: string | null;
  locationId?: string | null;
  reason?: 'initial' | 'response_1' | 'response_2';
}): Promise<string> {
  console.log('[DB ALERTS] Logging alert for user:', alert.userId, 'status:', alert.status);
  
  const timestamp = Date.now();
  
  const result = await query<{ id: string }>(
    `INSERT INTO alert_records (
      timestamp, danger_level, description, reason, user_id, phone_number, twilio_sid, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      timestamp,
      alert.severity,
      alert.message,
      alert.reason || 'initial',
      alert.userId,
      alert.phoneNumber,
      alert.twilioSid,
      alert.status
    ]
  );
  
  const id = result.rows[0]?.id || 'unknown';
  console.log('[DB ALERTS] Alert logged with id:', id);
  return id;
}

/**
 * Get last alert time for a user (for cooldown)
 */
export async function getLastAlertTime(userId: string): Promise<number | null> {
  console.log('[DB ALERTS] Getting last alert time for user:', userId);
  
  const result = await query<{ timestamp: number }>(
    `SELECT timestamp
    FROM alert_records
    WHERE user_id = $1
      AND status = 'sent'
    ORDER BY timestamp DESC
    LIMIT 1`,
    [userId]
  );
  
  if (result.rows.length === 0) {
    console.log('[DB ALERTS] No previous alerts found');
    return null;
  }
  
  console.log('[DB ALERTS] Last alert at:', result.rows[0].timestamp);
  return result.rows[0].timestamp;
}

/**
 * Get last alert time globally (for any user) - used when no specific user
 */
export async function getLastGlobalAlertTime(): Promise<number | null> {
  console.log('[DB ALERTS] Getting last global alert time');
  
  const result = await query<{ timestamp: number }>(
    `SELECT timestamp
    FROM alert_records
    WHERE status = 'sent'
    ORDER BY timestamp DESC
    LIMIT 1`
  );
  
  if (result.rows.length === 0) {
    console.log('[DB ALERTS] No previous alerts found globally');
    return null;
  }
  
  console.log('[DB ALERTS] Last global alert at:', result.rows[0].timestamp);
  return result.rows[0].timestamp;
}

/**
 * Check if user is within cooldown period
 */
export async function isUserInCooldown(userId: string, cooldownMs: number): Promise<boolean> {
  const lastAlert = await getLastAlertTime(userId);
  
  if (!lastAlert) {
    return false;
  }
  
  const timeSinceLastAlert = Date.now() - lastAlert;
  const inCooldown = timeSinceLastAlert < cooldownMs;
  
  console.log('[DB ALERTS] User cooldown check:', {
    userId,
    lastAlert,
    timeSinceLastAlert,
    cooldownMs,
    inCooldown
  });
  
  return inCooldown;
}

/**
 * Check if system is within global cooldown (when no specific user)
 */
export async function isGlobalCooldown(cooldownMs: number): Promise<boolean> {
  const lastAlert = await getLastGlobalAlertTime();
  
  if (!lastAlert) {
    return false;
  }
  
  const timeSinceLastAlert = Date.now() - lastAlert;
  const inCooldown = timeSinceLastAlert < cooldownMs;
  
  console.log('[DB ALERTS] Global cooldown check:', {
    lastAlert,
    timeSinceLastAlert,
    cooldownMs,
    inCooldown
  });
  
  return inCooldown;
}

/**
 * Get recent alerts for a user
 */
export async function getRecentAlerts(userId: string, limit: number = 10): Promise<AlertRecord[]> {
  console.log('[DB ALERTS] Getting recent alerts for user:', userId, 'limit:', limit);
  
  const result = await query<AlertRecord>(
    `SELECT 
      id,
      user_id,
      phone_number,
      description as message,
      twilio_sid,
      status,
      danger_level as severity,
      NULL as camera_id,
      NULL as location_id,
      timestamp,
      created_at
    FROM alert_records
    WHERE user_id = $1
    ORDER BY timestamp DESC
    LIMIT $2`,
    [userId, limit]
  );
  
  console.log('[DB ALERTS] Found', result.rows.length, 'recent alerts');
  return result.rows;
}

/**
 * Get alert statistics for a user
 */
export async function getAlertStats(userId: string, sinceDays: number = 30): Promise<{
  total: number;
  sent: number;
  failed: number;
  byLevel: { DANGER: number; WARNING: number };
}> {
  console.log('[DB ALERTS] Getting alert stats for user:', userId, 'since days:', sinceDays);
  
  const sinceTimestamp = Date.now() - (sinceDays * 24 * 60 * 60 * 1000);
  
  const result = await query<{
    status: string;
    danger_level: string;
    count: string;
  }>(
    `SELECT status, danger_level, COUNT(*) as count
    FROM alert_records
    WHERE user_id = $1 AND timestamp > $2
    GROUP BY status, danger_level`,
    [userId, sinceTimestamp]
  );
  
  const stats = {
    total: 0,
    sent: 0,
    failed: 0,
    byLevel: { DANGER: 0, WARNING: 0 }
  };
  
  for (const row of result.rows) {
    const count = parseInt(row.count, 10);
    stats.total += count;
    
    if (row.status === 'sent') stats.sent += count;
    if (row.status === 'failed') stats.failed += count;
    
    if (row.danger_level === 'DANGER') stats.byLevel.DANGER += count;
    if (row.danger_level === 'WARNING') stats.byLevel.WARNING += count;
  }
  
  console.log('[DB ALERTS] Alert stats:', stats);
  return stats;
}
