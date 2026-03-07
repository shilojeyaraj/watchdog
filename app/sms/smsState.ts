import fs from 'fs';
import path from 'path';

interface SMSState {
  consecutiveDangerCount: number;
  consecutiveIncidentCount: number; // Track consecutive detections for incident creation (requires 4)
  lastAlertSentTime: number | null;
  lastDangerLevel: string | null;
  lastIncidentDangerLevel: string | null; // Track last danger level for incident tracking
  alertHistory: AlertRecord[];
}

interface AlertRecord {
  timestamp: number;
  dangerLevel: string;
  description: string;
  reason: 'initial' | 'response_1' | 'response_2';
}

// File to persist state across restarts
const STATE_FILE = path.join(process.cwd(), '.sms-state.json');

// In-memory state
let state: SMSState = {
  consecutiveDangerCount: 0,
  consecutiveIncidentCount: 0,
  lastAlertSentTime: null,
  lastDangerLevel: null,
  lastIncidentDangerLevel: null,
  alertHistory: [],
};

/**
 * Load state from disk if it exists
 */
export function initializeState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      state = JSON.parse(data);
      console.log('[SMS] State restored from disk:', state);
    }
  } catch (error) {
    console.error('[SMS] Failed to load state from disk:', error);
    // Continue with default state
  }
}

/**
 * Persist state to disk
 */
function persistState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('[SMS] Failed to persist state to disk:', error);
  }
}

/**
 * Update danger level and consecutive count
 * @param dangerLevel - Current danger level: 'SAFE', 'WARNING', or 'DANGER'
 * @returns The updated consecutive danger count
 */
export function updateDangerLevel(dangerLevel: string): number {
  if (dangerLevel === 'DANGER') {
    if (state.lastDangerLevel === 'DANGER') {
      // Continue the streak
      state.consecutiveDangerCount++;
    } else {
      // Start a new streak
      state.consecutiveDangerCount = 1;
    }
  } else {
    // Reset streak if not DANGER
    state.consecutiveDangerCount = 0;
  }

  state.lastDangerLevel = dangerLevel;
  persistState();

  return state.consecutiveDangerCount;
}

/**
 * Update consecutive incident count (for WARNING and DANGER)
 * Requires 4 consecutive detections before creating an incident
 * @param dangerLevel - Current danger level: 'SAFE', 'WARNING', or 'DANGER'
 * @returns The updated consecutive incident count
 */
export function updateIncidentCount(dangerLevel: string): number {
  // Only track WARNING and DANGER for incidents
  if (dangerLevel === 'WARNING' || dangerLevel === 'DANGER') {
    if (state.lastIncidentDangerLevel === dangerLevel) {
      // Continue the streak for same danger level
      state.consecutiveIncidentCount++;
    } else {
      // Different danger level or first detection - start new streak
      state.consecutiveIncidentCount = 1;
    }
    state.lastIncidentDangerLevel = dangerLevel;
  } else {
    // SAFE resets the count
    state.consecutiveIncidentCount = 0;
    state.lastIncidentDangerLevel = null;
  }

  persistState();
  return state.consecutiveIncidentCount;
}

/**
 * Check if enough consecutive detections have occurred to create an incident
 * Requires 4 consecutive WARNING or DANGER detections
 * @returns True if we've had 4+ consecutive detections
 */
export function shouldCreateIncident(): boolean {
  return state.consecutiveIncidentCount >= 4;
}

/**
 * Get consecutive incident count
 */
export function getConsecutiveIncidentCount(): number {
  return state.consecutiveIncidentCount;
}

/**
 * Reset incident count (call after creating an incident to prevent duplicates)
 */
export function resetIncidentCount() {
  state.consecutiveIncidentCount = 0;
  state.lastIncidentDangerLevel = null;
  persistState();
}

/**
 * Check if enough consecutive DANGER events have occurred to trigger alert
 * @returns True if we've had 3+ consecutive DANGER events
 */
export function shouldTriggerAlert(): boolean {
  return state.consecutiveDangerCount >= 3;
}

/**
 * Check if we're within throttle window (1 minute)
 * @returns True if we sent an alert less than 60 seconds ago
 */
export function isThrottled(): boolean {
  if (state.lastAlertSentTime === null) {
    return false;
  }
  const now = Date.now();
  const timeSinceLastAlert = now - state.lastAlertSentTime;
  return timeSinceLastAlert < 60000; // 60 seconds in milliseconds
}

/**
 * Record that an alert was sent and reset throttle timer
 */
export function recordAlertSent(
  dangerLevel: string,
  description: string,
  reason: 'initial' | 'response_1' | 'response_2' = 'initial'
) {
  state.lastAlertSentTime = Date.now();
  state.alertHistory.push({
    timestamp: Date.now(),
    dangerLevel,
    description,
    reason,
  });

  // Keep only last 100 alerts
  if (state.alertHistory.length > 100) {
    state.alertHistory = state.alertHistory.slice(-100);
  }

  persistState();
}

/**
 * Get current state (for debugging/monitoring)
 */
export function getState(): SMSState {
  return { ...state };
}

/**
 * Reset state (for testing or manual reset)
 */
export function resetState() {
  state = {
    consecutiveDangerCount: 0,
    consecutiveIncidentCount: 0,
    lastAlertSentTime: null,
    lastDangerLevel: null,
    lastIncidentDangerLevel: null,
    alertHistory: [],
  };
  persistState();
}

/**
 * Get time remaining in throttle window (in seconds)
 * @returns Seconds remaining, or 0 if not throttled
 */
export function getThrottleTimeRemaining(): number {
  if (!isThrottled()) {
    return 0;
  }
  const now = Date.now();
  const timeSinceLastAlert = now - state.lastAlertSentTime!;
  const remaining = Math.ceil((60000 - timeSinceLastAlert) / 1000);
  return Math.max(0, remaining);
}

/**
 * Get the last recorded danger level
 */
export function getLastDangerLevel(): string | null {
  return state.lastDangerLevel;
}

/**
 * Get consecutive danger count
 */
export function getConsecutiveDangerCount(): number {
  return state.consecutiveDangerCount;
}
