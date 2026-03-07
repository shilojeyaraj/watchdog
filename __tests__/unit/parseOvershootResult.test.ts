import { describe, it, expect } from 'vitest'
import { parseOvershootResult } from '@/app/overshoot/parseOvershootResult'

describe('parseOvershootResult', () => {
  describe('valid input', () => {
    it('parses a well-formed result with all fields', () => {
      const input = JSON.stringify({
        level: 'DANGER',
        summary: 'Two people fighting',
        points: [[2, 3], [5, 7]],
      })

      const result = parseOvershootResult(input)

      expect(result).not.toBeNull()
      expect(result!.level).toBe('DANGER')
      expect(result!.summary).toBe('Two people fighting')
      expect(result!.grid[3][2]).toBe(true)  // point [2,3] → grid[y][x]
      expect(result!.grid[7][5]).toBe(true)
    })

    it('parses WARNING level', () => {
      const input = JSON.stringify({ level: 'WARNING', summary: '', points: [] })
      expect(parseOvershootResult(input)!.level).toBe('WARNING')
    })

    it('parses SAFE level', () => {
      const input = JSON.stringify({ level: 'SAFE', summary: '', points: [] })
      expect(parseOvershootResult(input)!.level).toBe('SAFE')
    })

    it('is case-insensitive for level', () => {
      const input = JSON.stringify({ level: 'danger', summary: '', points: [] })
      expect(parseOvershootResult(input)!.level).toBe('DANGER')
    })

    it('defaults unknown level to SAFE', () => {
      const input = JSON.stringify({ level: 'CRITICAL', summary: '', points: [] })
      expect(parseOvershootResult(input)!.level).toBe('SAFE')
    })

    it('returns empty summary when missing', () => {
      const input = JSON.stringify({ level: 'SAFE', points: [] })
      expect(parseOvershootResult(input)!.summary).toBe('')
    })

    it('returns 10x10 all-false grid when no points', () => {
      const input = JSON.stringify({ level: 'SAFE', summary: '', points: [] })
      const result = parseOvershootResult(input)!
      expect(result.grid).toHaveLength(10)
      expect(result.grid[0]).toHaveLength(10)
      expect(result.grid.flat().every((v) => v === false)).toBe(true)
    })
  })

  describe('grid population', () => {
    it('clamps out-of-bounds points to grid edges', () => {
      const input = JSON.stringify({
        level: 'SAFE',
        summary: '',
        points: [[-5, -5], [100, 100]],
      })
      const result = parseOvershootResult(input)!
      expect(result.grid[0][0]).toBe(true)   // (-5,-5) → (0,0)
      expect(result.grid[9][9]).toBe(true)   // (100,100) → (9,9)
    })

    it('skips points that are not [x, y] pairs', () => {
      const input = JSON.stringify({
        level: 'SAFE',
        summary: '',
        points: [[1], [1, 2, 3], 'bad', null],
      })
      const result = parseOvershootResult(input)!
      // Only [1,2,3] has length !== 2 and others are invalid - all skipped
      expect(result.grid.flat().filter(Boolean)).toHaveLength(0)
    })

    it('skips non-numeric coordinates', () => {
      const input = JSON.stringify({
        level: 'SAFE',
        summary: '',
        points: [['a', 'b']],
      })
      const result = parseOvershootResult(input)!
      expect(result.grid.flat().every((v) => v === false)).toBe(true)
    })

    it('rounds decimal coordinates to nearest integer', () => {
      const input = JSON.stringify({
        level: 'SAFE',
        summary: '',
        points: [[2.6, 3.4]],
      })
      const result = parseOvershootResult(input)!
      expect(result.grid[3][3]).toBe(true)  // x=round(2.6)=3, y=round(3.4)=3
    })
  })

  describe('text extraction', () => {
    it('extracts JSON embedded in surrounding text', () => {
      const input = `Analysis result: {"level":"DANGER","summary":"Alert","points":[]} - end`
      const result = parseOvershootResult(input)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('DANGER')
    })
  })

  describe('invalid input', () => {
    it('returns null for empty string', () => {
      expect(parseOvershootResult('')).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      expect(parseOvershootResult('{not valid json')).toBeNull()
    })

    it('returns null for non-object JSON', () => {
      expect(parseOvershootResult('[1, 2, 3]')).toBeNull()
    })

    it('returns null when no JSON braces found', () => {
      expect(parseOvershootResult('plain text with no json')).toBeNull()
    })
  })
})
