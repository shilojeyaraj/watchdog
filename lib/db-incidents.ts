// Database utilities for incident management
import { query } from './db';

export type IncidentStatus = 'open' | 'acknowledged' | 'responding' | 'resolved' | 'false_alarm';
export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';

type IncidentRow = {
  id: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  title: string;
  description: string | null;
  detected_at: Date;
  resolved_at: Date | null;
  camera_id: string | null;
  first_event_id: string;
  // Joined from the first event to give the UI a "location-ish" field (farthest/middle/closest).
  detection_section: 'farthest' | 'middle' | 'closest' | null;
};

export interface CreateIncidentData {
  user_id?: string | null;
  location_id?: string | null;
  status?: IncidentStatus;
  priority: IncidentPriority;
  title: string;
  description?: string;
  first_event_id: string;
  camera_id?: string;
  detected_at?: Date;
}

/**
 * Map DangerLevel to incident priority
 */
export function mapDangerLevelToPriority(level: 'SAFE' | 'WARNING' | 'DANGER'): IncidentPriority {
  switch (level) {
    case 'DANGER':
      return 'critical';
    case 'WARNING':
      return 'high';
    case 'SAFE':
      return 'medium';
  }
}

/**
 * Create an incident in the database
 */
export async function createIncident(data: CreateIncidentData): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO incidents (
      user_id, location_id, status, priority, title, description,
      first_event_id, camera_id, detected_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,
    [
      data.user_id || null,
      data.location_id || null,
      data.status || 'open',
      data.priority,
      data.title,
      data.description || null,
      data.first_event_id,
      data.camera_id || null,
      data.detected_at || new Date(),
    ]
  );

  return result.rows[0].id;
}

/**
 * Create an incident from a danger detection event
 */
export async function createIncidentFromEvent(
  eventId: string,
  dangerLevel: 'WARNING' | 'DANGER',
  description: string,
  options: {
    user_id?: string | null;
    location_id?: string | null;
    camera_id?: string;
  } = {}
): Promise<string> {
  const priority = mapDangerLevelToPriority(dangerLevel);
  const title = `${dangerLevel} incident detected`;

  return createIncident({
    user_id: options.user_id,
    location_id: options.location_id,
    status: 'open',
    priority,
    title,
    description,
    first_event_id: eventId,
    camera_id: options.camera_id,
  });
}

/**
 * Get incidents for a user
 */
export async function getIncidentsByUserId(
  userId: string,
  options: {
    status?: IncidentStatus;
    priority?: IncidentPriority;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<Array<{
  id: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  title: string;
  description: string | null;
  detected_at: Date;
  resolved_at: Date | null;
  camera_id: string | null;
  first_event_id: string;
  detection_section: 'farthest' | 'middle' | 'closest' | null;
}>> {
  const limit = options.limit || 100;
  const conditions: string[] = ['user_id = $1'];
  const params: any[] = [userId];
  let paramCount = 2;

  if (options.status) {
    conditions.push(`status = $${paramCount++}`);
    params.push(options.status);
  }

  if (options.priority) {
    conditions.push(`priority = $${paramCount++}`);
    params.push(options.priority);
  }

  if (options.startDate) {
    conditions.push(`detected_at >= $${paramCount++}`);
    params.push(options.startDate);
  }

  if (options.endDate) {
    conditions.push(`detected_at <= $${paramCount++}`);
    params.push(options.endDate);
  }

  const sql = `
    SELECT
      i.*,
      e.section AS detection_section
    FROM incidents i
    LEFT JOIN events e
      ON i.first_event_id = e.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.detected_at DESC
    LIMIT $${paramCount}
  `;
  params.push(limit);

  const result = await query<IncidentRow>(sql, params);
  return result.rows;
}

/**
 * Get all open incidents (for loading active incidents)
 */
export async function getOpenIncidents(
  userId?: string,
  limit: number = 100
): Promise<Array<{
  id: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  title: string;
  description: string | null;
  detected_at: Date;
  resolved_at: Date | null;
  camera_id: string | null;
  first_event_id: string;
  detection_section: 'farthest' | 'middle' | 'closest' | null;
}>> {
  const conditions: string[] = ["status = 'open'"];
  const params: any[] = [];
  let paramCount = 1;

  if (userId) {
    conditions.push(`user_id = $${paramCount++}`);
    params.push(userId);
  }

  const sql = `
    SELECT
      i.*,
      e.section AS detection_section
    FROM incidents i
    LEFT JOIN events e
      ON i.first_event_id = e.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.detected_at DESC
    LIMIT $${paramCount}
  `;
  params.push(limit);

  const result = await query<IncidentRow>(sql, params);
  return result.rows;
}

/**
 * Get all incidents (for loading all incidents)
 */
export async function getAllIncidents(
  userId?: string,
  limit: number = 100
): Promise<Array<{
  id: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  title: string;
  description: string | null;
  detected_at: Date;
  resolved_at: Date | null;
  camera_id: string | null;
  first_event_id: string;
  detection_section: 'farthest' | 'middle' | 'closest' | null;
}>> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramCount = 1;

  if (userId) {
    conditions.push(`user_id = $${paramCount++}`);
    params.push(userId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT
      i.*,
      e.section AS detection_section
    FROM incidents i
    LEFT JOIN events e
      ON i.first_event_id = e.id
    ${whereClause}
    ORDER BY i.detected_at DESC
    LIMIT $${paramCount}
  `;
  params.push(limit);

  const result = await query<IncidentRow>(sql, params);
  return result.rows;
}

/**
 * Update incident status
 */
export async function updateIncidentStatus(
  incidentId: string,
  status: IncidentStatus,
  resolutionNotes?: string
): Promise<void> {
  const updates: string[] = ['status = $1', 'updated_at = NOW()'];
  const values: any[] = [status];
  let paramCount = 2;

  if (status === 'resolved' || status === 'false_alarm') {
    updates.push(`resolved_at = NOW()`);
  }

  if (resolutionNotes) {
    updates.push(`resolution_notes = $${paramCount++}`);
    values.push(resolutionNotes);
  }

  values.push(incidentId);
  updates.push(`WHERE id = $${paramCount}`);

  await query(`UPDATE incidents SET ${updates.join(', ')}`, values);
}

/**
 * Get incident by ID
 */
export async function getIncidentById(incidentId: string) {
  const result = await query<{
    id: string;
    user_id: string | null;
    location_id: string | null;
    status: IncidentStatus;
    priority: IncidentPriority;
    title: string;
    description: string | null;
    detected_at: Date;
    acknowledged_at: Date | null;
    resolved_at: Date | null;
    resolution_notes: string | null;
    was_false_alarm: boolean;
    first_event_id: string;
    camera_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    'SELECT * FROM incidents WHERE id = $1',
    [incidentId]
  );

  return result.rows[0] || null;
}
