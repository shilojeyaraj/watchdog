import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { shouldThrottleEvent, clearThrottleState, getThrottleState } from '@/lib/db-event-throttle'

beforeEach(() => {
  clearThrottleState()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('shouldThrottleEvent', () => {
  describe('SAFE events', () => {
    it('never throttles SAFE events', () => {
      const result = shouldThrottleEvent('SAFE')
      expect(result.throttle).toBe(false)
    })

    it('does not update throttle state for SAFE', () => {
      shouldThrottleEvent('SAFE')
      expect(getThrottleState()).toHaveLength(0)
    })
  })

  describe('first occurrence', () => {
    it('allows the first DANGER event', () => {
      expect(shouldThrottleEvent('DANGER').throttle).toBe(false)
    })

    it('allows the first WARNING event', () => {
      expect(shouldThrottleEvent('WARNING').throttle).toBe(false)
    })

    it('allows first event per distinct section', () => {
      shouldThrottleEvent('DANGER', { section: 'closest' })
      const second = shouldThrottleEvent('DANGER', { section: 'farthest' })
      expect(second.throttle).toBe(false)
    })
  })

  describe('throttle window (15 seconds)', () => {
    it('throttles the same level within 15 seconds', () => {
      shouldThrottleEvent('DANGER', { cameraId: 'cam-1' })
      vi.advanceTimersByTime(5000)

      const result = shouldThrottleEvent('DANGER', { cameraId: 'cam-1' })
      expect(result.throttle).toBe(true)
    })

    it('allows the same level after 15 seconds', () => {
      shouldThrottleEvent('DANGER', { cameraId: 'cam-1' })
      vi.advanceTimersByTime(15001)

      const result = shouldThrottleEvent('DANGER', { cameraId: 'cam-1' })
      expect(result.throttle).toBe(false)
    })

    it('includes time remaining in throttle reason', () => {
      shouldThrottleEvent('DANGER')
      vi.advanceTimersByTime(5000)

      const result = shouldThrottleEvent('DANGER')
      expect(result.reason).toMatch(/throttled/)
    })
  })

  describe('state change bypass', () => {
    it('allows DANGER after WARNING immediately (different key per level)', () => {
      shouldThrottleEvent('WARNING', { section: 'closest' })
      vi.advanceTimersByTime(1000)

      // DANGER and WARNING generate different throttle keys, so DANGER
      // is treated as a first occurrence and is never throttled.
      const result = shouldThrottleEvent('DANGER', { section: 'closest' })
      expect(result.throttle).toBe(false)
    })

    it('allows WARNING after DANGER immediately', () => {
      shouldThrottleEvent('DANGER', { cameraId: 'cam-1' })
      vi.advanceTimersByTime(1000)

      expect(shouldThrottleEvent('WARNING', { cameraId: 'cam-1' }).throttle).toBe(false)
    })
  })

  describe('key isolation', () => {
    it('tracks different sections independently', () => {
      shouldThrottleEvent('DANGER', { section: 'closest' })
      // different section should not be throttled
      expect(shouldThrottleEvent('DANGER', { section: 'middle' }).throttle).toBe(false)
    })

    it('tracks different cameras independently', () => {
      shouldThrottleEvent('DANGER', { cameraId: 'cam-1' })
      expect(shouldThrottleEvent('DANGER', { cameraId: 'cam-2' }).throttle).toBe(false)
    })
  })

  describe('clearThrottleState', () => {
    it('resets all throttle entries', () => {
      shouldThrottleEvent('DANGER')
      shouldThrottleEvent('WARNING')
      clearThrottleState()

      expect(getThrottleState()).toHaveLength(0)
      // After clear, first call is allowed
      expect(shouldThrottleEvent('DANGER').throttle).toBe(false)
    })
  })
})
