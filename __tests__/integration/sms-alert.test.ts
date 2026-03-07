import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock all external I/O so the real smsState logic runs in isolation ────────

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
}))

vi.mock('@/app/sms/automated_message', () => ({
  sendInitialAlertSMS: vi.fn().mockResolvedValue({ sid: 'SM123' }),
}))

vi.mock('@/lib/db-events', () => ({
  createDangerDetectionEvent: vi.fn().mockResolvedValue('event-uuid-1'),
  mapDangerLevelToSeverity: vi.fn(),
  mapDangerLevelToEventType: vi.fn(),
}))

vi.mock('@/lib/db-incidents', () => ({
  createIncidentFromEvent: vi.fn().mockResolvedValue('incident-uuid-1'),
}))

vi.mock('@/lib/db-users', () => ({
  getUserByClerkId: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/db-event-throttle', () => ({
  shouldThrottleEvent: vi.fn().mockReturnValue({ throttle: false }),
  clearThrottleState: vi.fn(),
}))

// ── Import AFTER mocks are registered ────────────────────────────────────────

import { POST } from '@/app/api/sms/alert/route'
import { resetState, resetIncidentCount } from '@/app/sms/smsState'
import { sendInitialAlertSMS } from '@/app/sms/automated_message'
import { createDangerDetectionEvent } from '@/lib/db-events'
import { createIncidentFromEvent } from '@/lib/db-incidents'

// ─────────────────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/sms/alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  resetState()
  vi.clearAllMocks()
  // Re-apply default return values cleared by clearAllMocks
  ;(sendInitialAlertSMS as ReturnType<typeof vi.fn>).mockResolvedValue({ sid: 'SM123' })
  ;(createDangerDetectionEvent as ReturnType<typeof vi.fn>).mockResolvedValue('event-uuid-1')
  ;(createIncidentFromEvent as ReturnType<typeof vi.fn>).mockResolvedValue('incident-uuid-1')
})

// ─── Input validation ─────────────────────────────────────────────────────────

describe('POST /api/sms/alert - input validation', () => {
  it('returns 400 when dangerLevel is missing', async () => {
    const res = await POST(makeRequest({ description: 'test' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/dangerLevel/)
  })

  it('returns 400 for an unrecognised dangerLevel', async () => {
    const res = await POST(makeRequest({ dangerLevel: 'EXTREME' }))
    expect(res.status).toBe(400)
  })

  it('accepts SAFE as a valid dangerLevel', async () => {
    const res = await POST(makeRequest({ dangerLevel: 'SAFE' }))
    expect(res.status).toBe(200)
  })
})

// ─── SMS alert threshold (3 consecutive DANGER) ───────────────────────────────

describe('POST /api/sms/alert - SMS threshold', () => {
  it('does not send SMS for the first DANGER (count = 1)', async () => {
    const res = await POST(makeRequest({ dangerLevel: 'DANGER', description: 'fight' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.consecutiveCount).toBe(1)
    expect(sendInitialAlertSMS).not.toHaveBeenCalled()
  })

  it('does not send SMS for the second consecutive DANGER (count = 2)', async () => {
    await POST(makeRequest({ dangerLevel: 'DANGER' }))
    const res = await POST(makeRequest({ dangerLevel: 'DANGER' }))
    const body = await res.json()
    expect(body.consecutiveCount).toBe(2)
    expect(sendInitialAlertSMS).not.toHaveBeenCalled()
  })

  it('sends SMS on the third consecutive DANGER and returns success', async () => {
    await POST(makeRequest({ dangerLevel: 'DANGER' }))
    await POST(makeRequest({ dangerLevel: 'DANGER' }))
    const res = await POST(makeRequest({ dangerLevel: 'DANGER', description: 'alert!' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.consecutiveCount).toBe(3)
    expect(sendInitialAlertSMS).toHaveBeenCalledOnce()
    expect(sendInitialAlertSMS).toHaveBeenCalledWith('DANGER', 'alert!')
  })

  it('returns 429 when a second alert is triggered within the 60s throttle window', async () => {
    // Reach threshold and send first alert
    await POST(makeRequest({ dangerLevel: 'DANGER' }))
    await POST(makeRequest({ dangerLevel: 'DANGER' }))
    await POST(makeRequest({ dangerLevel: 'DANGER' }))

    // 4th DANGER - throttled
    const res = await POST(makeRequest({ dangerLevel: 'DANGER' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.throttled).toBe(true)
    // sendInitialAlertSMS called only once (not twice)
    expect(sendInitialAlertSMS).toHaveBeenCalledOnce()
  })

  it('resets consecutive count on SAFE and stops future alerts', async () => {
    await POST(makeRequest({ dangerLevel: 'DANGER' }))
    await POST(makeRequest({ dangerLevel: 'DANGER' }))
    await POST(makeRequest({ dangerLevel: 'SAFE' }))
    const res = await POST(makeRequest({ dangerLevel: 'DANGER' }))

    const body = await res.json()
    expect(body.consecutiveCount).toBe(1) // restarted from 1
    expect(sendInitialAlertSMS).not.toHaveBeenCalled()
  })

  it('does not send SMS alert for WARNING (only DANGER triggers SMS)', async () => {
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ dangerLevel: 'WARNING' }))
    }
    expect(sendInitialAlertSMS).not.toHaveBeenCalled()
  })
})

// ─── Event storage ────────────────────────────────────────────────────────────

describe('POST /api/sms/alert - event storage', () => {
  it('stores an event for DANGER detections', async () => {
    await POST(makeRequest({ dangerLevel: 'DANGER', description: 'fight detected' }))
    expect(createDangerDetectionEvent).toHaveBeenCalledOnce()
    expect(createDangerDetectionEvent).toHaveBeenCalledWith(
      'DANGER',
      'fight detected',
      expect.objectContaining({ consecutiveCount: 1 }),
    )
  })

  it('stores an event for WARNING detections', async () => {
    await POST(makeRequest({ dangerLevel: 'WARNING', description: 'suspicious' }))
    expect(createDangerDetectionEvent).toHaveBeenCalledOnce()
  })

  it('does not store an event for SAFE', async () => {
    await POST(makeRequest({ dangerLevel: 'SAFE' }))
    // SAFE is filtered inside createDangerDetectionEvent, but the route also
    // skips calling it for SAFE
    expect(createDangerDetectionEvent).not.toHaveBeenCalled()
  })

  it('includes eventId in response body', async () => {
    const res = await POST(makeRequest({ dangerLevel: 'DANGER' }))
    const body = await res.json()
    expect(body.eventId).toBe('event-uuid-1')
  })
})

// ─── Incident creation (4 consecutive detections) ────────────────────────────

describe('POST /api/sms/alert - incident creation', () => {
  it('does not create an incident before 4 consecutive detections', async () => {
    for (let i = 0; i < 3; i++) {
      await POST(makeRequest({ dangerLevel: 'DANGER' }))
    }
    expect(createIncidentFromEvent).not.toHaveBeenCalled()
  })

  it('creates an incident on the 4th consecutive DANGER', async () => {
    for (let i = 0; i < 4; i++) {
      await POST(makeRequest({ dangerLevel: 'DANGER', description: 'fight' }))
    }
    expect(createIncidentFromEvent).toHaveBeenCalledOnce()
  })

  it('includes incidentId in response body when incident and SMS fire together', async () => {
    // The route only includes incidentId in the 200 SMS-sent response.
    // Incident triggers at ≥4 consecutive, SMS triggers at ≥3 consecutive.
    // So we need: 3 DANGER (SMS sent → throttled), wait 60s, then 4th DANGER
    // (throttle cleared → SMS sends again AND incident count = 4 → incident created).
    vi.useFakeTimers()

    for (let i = 0; i < 3; i++) {
      await POST(makeRequest({ dangerLevel: 'DANGER' }))
    }
    // Advance past the 60-second throttle window
    vi.advanceTimersByTime(61000)

    const res = await POST(makeRequest({ dangerLevel: 'DANGER' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.incidentId).toBe('incident-uuid-1')

    vi.useRealTimers()
  })

  it('resets incident count after creating an incident', async () => {
    for (let i = 0; i < 4; i++) {
      await POST(makeRequest({ dangerLevel: 'DANGER' }))
    }
    // Next 3 DANGER events should NOT create another incident
    vi.clearAllMocks()
    ;(createDangerDetectionEvent as ReturnType<typeof vi.fn>).mockResolvedValue('event-uuid-2')
    for (let i = 0; i < 3; i++) {
      await POST(makeRequest({ dangerLevel: 'DANGER' }))
    }
    expect(createIncidentFromEvent).not.toHaveBeenCalled()
  })
})
