import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mapDangerLevelToSeverity,
  mapDangerLevelToEventType,
  createDangerDetectionEvent,
} from '@/lib/db-events'

vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ id: 'event-abc-123' }] }),
}))

import { query } from '@/lib/db'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('mapDangerLevelToSeverity', () => {
  it('maps DANGER to CRITICAL', () => {
    expect(mapDangerLevelToSeverity('DANGER')).toBe('CRITICAL')
  })

  it('maps WARNING to MEDIUM', () => {
    expect(mapDangerLevelToSeverity('WARNING')).toBe('MEDIUM')
  })

  it('maps SAFE to LOW', () => {
    expect(mapDangerLevelToSeverity('SAFE')).toBe('LOW')
  })
})

describe('mapDangerLevelToEventType', () => {
  it('maps DANGER to danger_detected', () => {
    expect(mapDangerLevelToEventType('DANGER')).toBe('danger_detected')
  })

  it('maps WARNING to warning_detected', () => {
    expect(mapDangerLevelToEventType('WARNING')).toBe('warning_detected')
  })

  it('maps SAFE to null (no event stored)', () => {
    expect(mapDangerLevelToEventType('SAFE')).toBeNull()
  })
})

describe('createDangerDetectionEvent', () => {
  it('returns null for SAFE level (no event stored)', async () => {
    const result = await createDangerDetectionEvent('SAFE', 'All clear')
    expect(result).toBeNull()
    expect(query).not.toHaveBeenCalled()
  })

  it('creates a DANGER event and returns id', async () => {
    const result = await createDangerDetectionEvent('DANGER', 'Fight detected')
    expect(result).toBe('event-abc-123')
    expect(query).toHaveBeenCalledOnce()
  })

  it('creates a WARNING event and returns id', async () => {
    const result = await createDangerDetectionEvent('WARNING', 'Suspicious activity')
    expect(result).toBe('event-abc-123')
    expect(query).toHaveBeenCalledOnce()
  })

  it('includes section in the title when provided', async () => {
    await createDangerDetectionEvent('DANGER', 'desc', { section: 'closest' })
    const [sql, params] = (query as ReturnType<typeof vi.fn>).mock.calls[0]
    // title is the 4th param ($4)
    expect(params[3]).toContain('closest')
  })

  it('includes personGrid count in metadata when provided', async () => {
    const personGrid = [[true, false], [false, true]]
    await createDangerDetectionEvent('DANGER', 'desc', { personGrid })

    const [, params] = (query as ReturnType<typeof vi.fn>).mock.calls[0]
    const metadata = JSON.parse(params[5]) // metadata is $6
    expect(metadata.person_count).toBe(2)
  })

  it('passes consecutiveCount into metadata', async () => {
    await createDangerDetectionEvent('DANGER', 'desc', { consecutiveCount: 5 })

    const [, params] = (query as ReturnType<typeof vi.fn>).mock.calls[0]
    const metadata = JSON.parse(params[5])
    expect(metadata.consecutive_count).toBe(5)
  })
})
