// Database utilities for event storage
import { query } from './db';

export type DangerLevel = 'SAFE' | 'WARNING' | 'DANGER';
export type EventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type EventType = 'danger_detected' | 'warning_detected' | 'alert_sent' | 'consecutive_threshold';

export interface CreateEventData {
  user_id?: string | null;
  event_type: EventType;
  severity: EventSeverity;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  camera_id?: string;
  section?: 'farthest' | 'middle' | 'closest' | null;
  occurred_at?: Date;
}

/**
 * Map DangerLevel to database severity
 */
export function mapDangerLevelToSeverity(level: DangerLevel): EventSeverity {
  switch (level) {
    case 'DANGER':
      return 'CRITICAL';
    case 'WARNING':
      return 'MEDIUM';
    case 'SAFE':
      return 'LOW';
  }
}

/**
 * Map DangerLevel to event type
 */
export function mapDangerLevelToEventType(level: DangerLevel): EventType | null {
  switch (level) {
    case 'DANGER':
      return 'danger_detected';
    case 'WARNING':
      return 'warning_detected';
    case 'SAFE':
      return null; // Don't store SAFE events
  }
}

/**
 * Create an event in the database
 */
export async function createEvent(data: CreateEventData): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO events (
      user_id, event_type, severity, title, description, metadata, 
      camera_id, section, occurred_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,
    [
      data.user_id || null,
      data.event_type,
      data.severity,
      data.title,
      data.description || null,
      JSON.stringify(data.metadata || {}),
      data.camera_id || null,
      data.section || null,
      data.occurred_at || new Date(),
    ]
  );

  return result.rows[0].id;
}

/**
 * Create an event from danger detection
 */
export async function createDangerDetectionEvent(
  dangerLevel: DangerLevel,
  description: string,
  options: {
    user_id?: string | null;
    camera_id?: string;
    section?: 'farthest' | 'middle' | 'closest';
    personGrid?: boolean[][];
    consecutiveCount?: number;
  } = {}
): Promise<string | null> {
  const eventType = mapDangerLevelToEventType(dangerLevel);
  if (!eventType) {
    return null; // Don't store SAFE events
  }

  const severity = mapDangerLevelToSeverity(dangerLevel);
  const title = `${dangerLevel} detected${options.section ? ` in ${options.section} section` : ''}`;

  const metadata: Record<string, any> = {
    danger_level: dangerLevel,
    consecutive_count: options.consecutiveCount || 0,
  };

  if (options.section) {
    metadata.section = options.section;
  }

  if (options.personGrid) {
    metadata.grid = options.personGrid;
    // Count people in grid
    const personCount = options.personGrid.flat().filter(Boolean).length;
    metadata.person_count = personCount;
  }

  return createEvent({
    user_id: options.user_id,
    event_type: eventType,
    severity,
    title,
    description,
    metadata,
    camera_id: options.camera_id,
    section: options.section || null,
  });
}

/**
 * Get events for a user
 */
export async function getEventsByUserId(
  userId: string,
  options: {
    limit?: number;
    event_type?: EventType;
    severity?: EventSeverity;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<Array<{
  id: string;
  event_type: string;
  severity: string;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  camera_id: string | null;
  section: string | null;
  occurred_at: Date;
}>> {
  const limit = options.limit || 100;
  const conditions: string[] = ['user_id = $1'];
  const params: any[] = [userId];
  let paramCount = 2;

  if (options.event_type) {
    conditions.push(`event_type = $${paramCount++}`);
    params.push(options.event_type);
  }

  if (options.severity) {
    conditions.push(`severity = $${paramCount++}`);
    params.push(options.severity);
  }

  if (options.startDate) {
    conditions.push(`occurred_at >= $${paramCount++}`);
    params.push(options.startDate);
  }

  if (options.endDate) {
    conditions.push(`occurred_at <= $${paramCount++}`);
    params.push(options.endDate);
  }

  const sql = `
    SELECT * FROM events 
    WHERE ${conditions.join(' AND ')}
    ORDER BY occurred_at DESC 
    LIMIT $${paramCount}
  `;
  params.push(limit);

  type EventRow = {
    id: string; event_type: string; severity: string; title: string;
    description: string | null; metadata: any; camera_id: string | null;
    section: string | null; occurred_at: Date;
  };
  const result = await query<EventRow>(sql, params);

  return result.rows.map(row => ({
    ...row,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
  }));
}

/**
 * Get all warning events (for loading warnings)
 */
export async function getWarningEvents(
  userId?: string,
  limit: number = 100
): Promise<Array<{
  id: string;
  event_type: string;
  severity: string;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  camera_id: string | null;
  section: string | null;
  occurred_at: Date;
}>> {
  const conditions: string[] = ["event_type = 'warning_detected'"];
  const params: any[] = [];
  let paramCount = 1;

  if (userId) {
    conditions.push(`user_id = $${paramCount++}`);
    params.push(userId);
  }

  const sql = `
    SELECT * FROM events 
    WHERE ${conditions.join(' AND ')}
    ORDER BY occurred_at DESC 
    LIMIT $${paramCount}
  `;
  params.push(limit);

  type EventRow = {
    id: string; event_type: string; severity: string; title: string;
    description: string | null; metadata: any; camera_id: string | null;
    section: string | null; occurred_at: Date;
  };
  const result = await query<EventRow>(sql, params);

  return result.rows.map(row => ({
    ...row,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
  }));
}
