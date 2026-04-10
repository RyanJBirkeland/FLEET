import { describe, it, expect } from 'vitest'
import { nowIso } from '../time'

describe('time utilities', () => {
  describe('nowIso', () => {
    it('should return ISO 8601 timestamp', () => {
      const result = nowIso()
      // Validate ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should return current time', () => {
      const before = Date.now()
      const result = new Date(nowIso()).getTime()
      const after = Date.now()
      expect(result).toBeGreaterThanOrEqual(before)
      expect(result).toBeLessThanOrEqual(after)
    })
  })
})
