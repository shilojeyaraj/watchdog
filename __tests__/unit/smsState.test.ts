import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fs BEFORE importing smsState so disk I/O never runs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('{}'),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
}))

import {
  updateDangerLevel,
  updateIncidentCount,
  shouldTriggerAlert,
  shouldCreateIncident,
  isThrottled,
  recordAlertSent,
  resetState,
  resetIncidentCount,
  getConsecutiveDangerCount,
  getConsecutiveIncidentCount,
  getLastDangerLevel,
  getThrottleTimeRemaining,
  getState,
  initializeState,
} from '@/app/sms/smsState'

beforeEach(() => {
  resetState()
  vi.clearAllMocks()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── updateDangerLevel ────────────────────────────────────────────────────────

describe('updateDangerLevel', () => {
  it('starts a streak at 1 on the first DANGER', () => {
    expect(updateDangerLevel('DANGER')).toBe(1)
  })

  it('increments the streak on consecutive DANGER events', () => {
    updateDangerLevel('DANGER')
    updateDangerLevel('DANGER')
    expect(updateDangerLevel('DANGER')).toBe(3)
  })

  it('resets streak to 0 on SAFE', () => {
    updateDangerLevel('DANGER')
    updateDangerLevel('DANGER')
    expect(updateDangerLevel('SAFE')).toBe(0)
  })

  it('resets streak to 0 on WARNING', () => {
    updateDangerLevel('DANGER')
    expect(updateDangerLevel('WARNING')).toBe(0)
  })

  it('restarts streak at 1 after a reset', () => {
    updateDangerLevel('DANGER')
    updateDangerLevel('SAFE')
    expect(updateDangerLevel('DANGER')).toBe(1)
  })

  it('tracks last danger level', () => {
    updateDangerLevel('WARNING')
    expect(getLastDangerLevel()).toBe('WARNING')
  })
})

// ─── shouldTriggerAlert ───────────────────────────────────────────────────────

describe('shouldTriggerAlert', () => {
  it('returns false with 0 consecutive DANGER events', () => {
    expect(shouldTriggerAlert()).toBe(false)
  })

  it('returns false with 2 consecutive DANGER events', () => {
    updateDangerLevel('DANGER')
    updateDangerLevel('DANGER')
    expect(shouldTriggerAlert()).toBe(false)
  })

  it('returns true at exactly 3 consecutive DANGER events', () => {
    updateDangerLevel('DANGER')
    updateDangerLevel('DANGER')
    updateDangerLevel('DANGER')
    expect(shouldTriggerAlert()).toBe(true)
  })

  it('returns true beyond 3 consecutive DANGER events', () => {
    for (let i = 0; i < 5; i++) updateDangerLevel('DANGER')
    expect(shouldTriggerAlert()).toBe(true)
  })

  it('returns false after streak is broken', () => {
    updateDangerLevel('DANGER')
    updateDangerLevel('DANGER')
    updateDangerLevel('DANGER')
    updateDangerLevel('SAFE')
    expect(shouldTriggerAlert()).toBe(false)
  })
})

// ─── isThrottled / recordAlertSent ───────────────────────────────────────────

describe('isThrottled', () => {
  it('returns false when no alert has been sent', () => {
    expect(isThrottled()).toBe(false)
  })

  it('returns true immediately after an alert is sent', () => {
    recordAlertSent('DANGER', 'test')
    expect(isThrottled()).toBe(true)
  })

  it('returns false after 60 seconds have elapsed', () => {
    vi.useFakeTimers()
    recordAlertSent('DANGER', 'test')
    vi.advanceTimersByTime(60001)
    expect(isThrottled()).toBe(false)
  })

  it('returns true at exactly 59 seconds', () => {
    vi.useFakeTimers()
    recordAlertSent('DANGER', 'test')
    vi.advanceTimersByTime(59000)
    expect(isThrottled()).toBe(true)
  })
})

describe('getThrottleTimeRemaining', () => {
  it('returns 0 when not throttled', () => {
    expect(getThrottleTimeRemaining()).toBe(0)
  })

  it('returns remaining seconds when throttled', () => {
    vi.useFakeTimers()
    recordAlertSent('DANGER', 'test')
    vi.advanceTimersByTime(30000) // 30s elapsed
    const remaining = getThrottleTimeRemaining()
    expect(remaining).toBeGreaterThanOrEqual(29)
    expect(remaining).toBeLessThanOrEqual(30)
  })

  it('returns 0 after throttle expires', () => {
    vi.useFakeTimers()
    recordAlertSent('DANGER', 'test')
    vi.advanceTimersByTime(61000)
    expect(getThrottleTimeRemaining()).toBe(0)
  })
})

// ─── recordAlertSent ─────────────────────────────────────────────────────────

describe('recordAlertSent', () => {
  it('adds an entry to alertHistory', () => {
    recordAlertSent('DANGER', 'description', 'initial')
    expect(getState().alertHistory).toHaveLength(1)
  })

  it('records reason correctly', () => {
    recordAlertSent('WARNING', 'desc', 'response_1')
    expect(getState().alertHistory[0].reason).toBe('response_1')
  })

  it('caps alertHistory at 100 entries', () => {
    for (let i = 0; i < 110; i++) {
      recordAlertSent('DANGER', `alert ${i}`)
    }
    expect(getState().alertHistory).toHaveLength(100)
  })

  it('keeps the most recent entries when capped', () => {
    for (let i = 0; i < 105; i++) {
      recordAlertSent('DANGER', `alert ${i}`)
    }
    const history = getState().alertHistory
    expect(history[0].description).toBe('alert 5')  // oldest kept
    expect(history[99].description).toBe('alert 104') // newest
  })
})

// ─── updateIncidentCount / shouldCreateIncident ───────────────────────────────

describe('updateIncidentCount', () => {
  it('starts streak at 1 on first WARNING', () => {
    expect(updateIncidentCount('WARNING')).toBe(1)
  })

  it('starts streak at 1 on first DANGER', () => {
    expect(updateIncidentCount('DANGER')).toBe(1)
  })

  it('increments for consecutive same-level detections', () => {
    updateIncidentCount('DANGER')
    updateIncidentCount('DANGER')
    expect(updateIncidentCount('DANGER')).toBe(3)
  })

  it('resets to 0 on SAFE', () => {
    updateIncidentCount('DANGER')
    updateIncidentCount('DANGER')
    expect(updateIncidentCount('SAFE')).toBe(0)
  })

  it('resets to 1 when level changes (DANGER → WARNING)', () => {
    updateIncidentCount('DANGER')
    updateIncidentCount('DANGER')
    expect(updateIncidentCount('WARNING')).toBe(1)
  })
})

describe('shouldCreateIncident', () => {
  it('returns false below threshold of 4', () => {
    updateIncidentCount('DANGER')
    updateIncidentCount('DANGER')
    updateIncidentCount('DANGER')
    expect(shouldCreateIncident()).toBe(false)
  })

  it('returns true at exactly 4 consecutive detections', () => {
    for (let i = 0; i < 4; i++) updateIncidentCount('DANGER')
    expect(shouldCreateIncident()).toBe(true)
  })
})

describe('resetIncidentCount', () => {
  it('resets count to 0', () => {
    for (let i = 0; i < 4; i++) updateIncidentCount('DANGER')
    resetIncidentCount()
    expect(getConsecutiveIncidentCount()).toBe(0)
    expect(shouldCreateIncident()).toBe(false)
  })

  it('requires another 4 detections after reset', () => {
    for (let i = 0; i < 4; i++) updateIncidentCount('DANGER')
    resetIncidentCount()
    for (let i = 0; i < 3; i++) updateIncidentCount('DANGER')
    expect(shouldCreateIncident()).toBe(false)
  })
})

// ─── initializeState ─────────────────────────────────────────────────────────

describe('initializeState', () => {
  it('keeps default state when no file exists on disk (existsSync returns false)', () => {
    initializeState()
    expect(getConsecutiveDangerCount()).toBe(0)
  })
})

// ─── resetState ───────────────────────────────────────────────────────────────

describe('resetState', () => {
  it('zeroes out all counts and clears history', () => {
    for (let i = 0; i < 5; i++) updateDangerLevel('DANGER')
    recordAlertSent('DANGER', 'test')
    resetState()

    const state = getState()
    expect(state.consecutiveDangerCount).toBe(0)
    expect(state.consecutiveIncidentCount).toBe(0)
    expect(state.lastAlertSentTime).toBeNull()
    expect(state.alertHistory).toHaveLength(0)
  })
})
