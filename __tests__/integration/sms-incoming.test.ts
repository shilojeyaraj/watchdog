import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

vi.mock('@/app/sms/automated_message', () => ({
  sendStatusResponseSMS: vi.fn().mockResolvedValue({ sid: 'SM_status' }),
  sendImageResponseSMS: vi.fn().mockResolvedValue({ sid: 'SM_image' }),
}))

// Note: sendInvalidResponseSMS in the route uses require('twilio') directly
// (an architectural violation - it should use the automated_message wrapper).
// We test the observable behaviour (status 200, wrappers not called) rather
// than asserting on the Twilio client internals.

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import { POST } from '@/app/api/sms/incoming/route'
import { resetState, updateDangerLevel } from '@/app/sms/smsState'
import { sendStatusResponseSMS, sendImageResponseSMS } from '@/app/sms/automated_message'

// ─────────────────────────────────────────────────────────────────────────────

const EXPECTED_NUMBER = '+15550001234'

function makeIncomingRequest(from: string, body: string) {
  const params = new URLSearchParams({ From: from, Body: body, MessageSid: 'SM_test' })
  return new NextRequest('http://localhost/api/sms/incoming', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
}

beforeEach(() => {
  resetState()
  vi.clearAllMocks()
  ;(sendStatusResponseSMS as ReturnType<typeof vi.fn>).mockResolvedValue({ sid: 'SM_status' })
  ;(sendImageResponseSMS as ReturnType<typeof vi.fn>).mockResolvedValue({ sid: 'SM_image' })
  process.env.TWILIO_TO_NUMBER = EXPECTED_NUMBER
  process.env.TWILIO_FROM_NUMBER = '+15559998888'
  process.env.TWILIO_ACCOUNT_SID = 'ACtest'
  process.env.TWILIO_AUTH_TOKEN = 'test-token'
})

// ─── Always returns 200 ───────────────────────────────────────────────────────

describe('POST /api/sms/incoming - always 200', () => {
  it('returns 200 for response "1"', async () => {
    const res = await POST(makeIncomingRequest(EXPECTED_NUMBER, '1'))
    expect(res.status).toBe(200)
  })

  it('returns 200 for response "2"', async () => {
    const res = await POST(makeIncomingRequest(EXPECTED_NUMBER, '2'))
    expect(res.status).toBe(200)
  })

  it('returns 200 for unknown response text', async () => {
    const res = await POST(makeIncomingRequest(EXPECTED_NUMBER, 'hello'))
    expect(res.status).toBe(200)
  })

  it('returns 200 for messages from unknown phone numbers', async () => {
    const res = await POST(makeIncomingRequest('+19999999999', '1'))
    expect(res.status).toBe(200)
  })

  it('returns 200 even when sendStatusResponseSMS throws', async () => {
    ;(sendStatusResponseSMS as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Twilio error'),
    )
    const res = await POST(makeIncomingRequest(EXPECTED_NUMBER, '1'))
    expect(res.status).toBe(200)
  })

  it('returns 200 even when sendImageResponseSMS throws', async () => {
    ;(sendImageResponseSMS as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Twilio error'),
    )
    const res = await POST(makeIncomingRequest(EXPECTED_NUMBER, '2'))
    expect(res.status).toBe(200)
  })
})

// ─── Phone number gating ──────────────────────────────────────────────────────

describe('POST /api/sms/incoming - unknown sender', () => {
  it('does not call any SMS wrapper function for an unknown number', async () => {
    await POST(makeIncomingRequest('+19999999999', '1'))
    expect(sendStatusResponseSMS).not.toHaveBeenCalled()
    expect(sendImageResponseSMS).not.toHaveBeenCalled()
  })
})

// ─── Response routing ─────────────────────────────────────────────────────────

describe('POST /api/sms/incoming - response "1" (status)', () => {
  it('calls sendStatusResponseSMS with the last known danger level', async () => {
    updateDangerLevel('DANGER')
    await POST(makeIncomingRequest(EXPECTED_NUMBER, '1'))
    expect(sendStatusResponseSMS).toHaveBeenCalledOnce()
    expect(sendStatusResponseSMS).toHaveBeenCalledWith('DANGER', '')
  })

  it('sends UNKNOWN when no danger level has been recorded', async () => {
    await POST(makeIncomingRequest(EXPECTED_NUMBER, '1'))
    expect(sendStatusResponseSMS).toHaveBeenCalledWith('UNKNOWN', '')
  })

  it('does not call sendImageResponseSMS for response "1"', async () => {
    await POST(makeIncomingRequest(EXPECTED_NUMBER, '1'))
    expect(sendImageResponseSMS).not.toHaveBeenCalled()
  })
})

describe('POST /api/sms/incoming - response "2" (image)', () => {
  it('calls sendImageResponseSMS', async () => {
    await POST(makeIncomingRequest(EXPECTED_NUMBER, '2'))
    expect(sendImageResponseSMS).toHaveBeenCalledOnce()
  })

  it('does not call sendStatusResponseSMS for response "2"', async () => {
    await POST(makeIncomingRequest(EXPECTED_NUMBER, '2'))
    expect(sendStatusResponseSMS).not.toHaveBeenCalled()
  })
})

describe('POST /api/sms/incoming - invalid response', () => {
  it('returns 200 for unrecognised input (does not re-throw Twilio errors)', async () => {
    // sendInvalidResponseSMS uses require('twilio') directly - we only verify
    // the route stays resilient and the wrappers are untouched.
    const res = await POST(makeIncomingRequest(EXPECTED_NUMBER, 'yes'))
    expect(res.status).toBe(200)
  })

  it('does not call sendStatusResponseSMS or sendImageResponseSMS', async () => {
    await POST(makeIncomingRequest(EXPECTED_NUMBER, 'yes'))
    expect(sendStatusResponseSMS).not.toHaveBeenCalled()
    expect(sendImageResponseSMS).not.toHaveBeenCalled()
  })

  it('trims whitespace from response before matching', async () => {
    await POST(makeIncomingRequest(EXPECTED_NUMBER, '  1  '))
    expect(sendStatusResponseSMS).toHaveBeenCalledOnce()
  })
})
