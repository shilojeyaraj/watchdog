// Event throttling utility to prevent spam
// Tracks last event time per danger level and section to throttle duplicate events

interface ThrottleKey {
  dangerLevel: 'WARNING' | 'DANGER';
  section?: 'farthest' | 'middle' | 'closest' | null;
  cameraId?: string;
}

interface ThrottleState {
  lastEventTime: number;
  lastDangerLevel: 'WARNING' | 'DANGER' | null;
}

// In-memory throttle state (keyed by danger level + section + camera)
// Format: "DANGER:closest:camera-1" -> { lastEventTime, lastDangerLevel }
const throttleState = new Map<string, ThrottleState>();

// Throttle interval: 15 seconds (15000ms)
const EVENT_THROTTLE_INTERVAL_MS = 15000;

/**
 * Generate throttle key from danger level, section, and camera
 */
function getThrottleKey(key: ThrottleKey): string {
  const section = key.section || 'none';
  const camera = key.cameraId || 'default';
  return `${key.dangerLevel}:${section}:${camera}`;
}

/**
 * Check if we should throttle event storage
 * Returns true if we should throttle (skip storing), false if we should store
 * 
 * Rules:
 * - Always allow if danger level changed (SAFE→WARNING, WARNING→DANGER, etc.)
 * - Throttle if same danger level within 15 seconds
 */
export function shouldThrottleEvent(
  dangerLevel: 'SAFE' | 'WARNING' | 'DANGER',
  options: {
    section?: 'farthest' | 'middle' | 'closest' | null;
    cameraId?: string;
  } = {}
): { throttle: boolean; reason?: string } {
  // Don't throttle SAFE (we don't store SAFE events anyway)
  if (dangerLevel === 'SAFE') {
    return { throttle: false };
  }

  // Don't throttle WARNING or DANGER - we want to check for state changes
  const key = getThrottleKey({
    dangerLevel: dangerLevel as 'WARNING' | 'DANGER',
    section: options.section,
    cameraId: options.cameraId,
  });

  const state = throttleState.get(key);
  const now = Date.now();

  // No previous state - allow storing
  if (!state) {
    throttleState.set(key, {
      lastEventTime: now,
      lastDangerLevel: dangerLevel as 'WARNING' | 'DANGER',
    });
    return { throttle: false };
  }

  // Check if danger level changed (always allow state changes)
  if (state.lastDangerLevel !== dangerLevel) {
    // State changed - update and allow
    throttleState.set(key, {
      lastEventTime: now,
      lastDangerLevel: dangerLevel as 'WARNING' | 'DANGER',
    });
    return { throttle: false, reason: 'state_change' };
  }

  // Same danger level - check throttle interval
  const timeSinceLastEvent = now - state.lastEventTime;
  
  if (timeSinceLastEvent < EVENT_THROTTLE_INTERVAL_MS) {
    // Within throttle window - throttle
    return {
      throttle: true,
      reason: `throttled: ${Math.ceil((EVENT_THROTTLE_INTERVAL_MS - timeSinceLastEvent) / 1000)}s remaining`,
    };
  }

  // Outside throttle window - allow and update
  throttleState.set(key, {
    lastEventTime: now,
    lastDangerLevel: dangerLevel as 'WARNING' | 'DANGER',
  });
  
  return { throttle: false };
}

/**
 * Clear throttle state (useful for testing or reset)
 */
export function clearThrottleState() {
  throttleState.clear();
}

/**
 * Get throttle state (for debugging)
 */
export function getThrottleState() {
  return Array.from(throttleState.entries()).map(([key, state]) => ({
    key,
    ...state,
    timeSinceLastEvent: Date.now() - state.lastEventTime,
  }));
}
