import { describe, it, expect } from 'vitest'
import { formatCount, STAGE_CONFIG, STAGE_TO_FILTER } from '../sankey-utils'

describe('sankey-utils', () => {
  describe('formatCount', () => {
    it('returns number as string for counts under 1000', () => {
      expect(formatCount(0)).toBe('0')
      expect(formatCount(42)).toBe('42')
      expect(formatCount(999)).toBe('999')
    })

    it('abbreviates counts of 1000+', () => {
      expect(formatCount(1000)).toBe('1.0k')
      expect(formatCount(1234)).toBe('1.2k')
      expect(formatCount(9999)).toBe('10.0k')
    })
  })

  describe('STAGE_CONFIG', () => {
    it('has entries for all 6 stages', () => {
      expect(Object.keys(STAGE_CONFIG)).toEqual(
        expect.arrayContaining(['queued', 'active', 'review', 'done', 'blocked', 'failed'])
      )
      expect(Object.keys(STAGE_CONFIG)).toHaveLength(6)
    })

    it('each stage has accent and label', () => {
      for (const config of Object.values(STAGE_CONFIG)) {
        expect(config).toHaveProperty('accent')
        expect(config).toHaveProperty('label')
      }
    })
  })

  describe('STAGE_TO_FILTER', () => {
    it('maps stage keys to StatusFilter values', () => {
      expect(STAGE_TO_FILTER.queued).toBe('todo')
      expect(STAGE_TO_FILTER.active).toBe('in-progress')
      expect(STAGE_TO_FILTER.review).toBe('awaiting-review')
      expect(STAGE_TO_FILTER.done).toBe('done')
      expect(STAGE_TO_FILTER.blocked).toBe('blocked')
      expect(STAGE_TO_FILTER.failed).toBe('failed')
    })
  })
})
