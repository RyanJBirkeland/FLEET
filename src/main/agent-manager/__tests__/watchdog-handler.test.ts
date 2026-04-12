import { describe, it, expect } from 'vitest'
import { handleWatchdogVerdict } from '../watchdog-handler'
import type { WatchdogAction } from '../types'

describe('handleWatchdogVerdict', () => {
  const now = '2026-04-12T12:00:00.000Z'

  describe('max-runtime verdict', () => {
    it('returns error status with terminal notification', () => {
      const result = handleWatchdogVerdict('max-runtime', now, 3600000)

      expect(result.shouldNotifyTerminal).toBe(true)
      expect(result.terminalStatus).toBe('error')
      expect(result.taskUpdate).toMatchObject({
        status: 'error',
        completed_at: now,
        claimed_by: null,
        needs_review: true
      })
      expect(result.taskUpdate?.notes).toContain('60 minutes')
    })

    it('includes custom runtime in notes when provided', () => {
      const result = handleWatchdogVerdict('max-runtime', now, 7200000)

      expect(result.taskUpdate?.notes).toContain('120 minutes')
    })

    it('defaults to 60 minutes when maxRuntimeMs is undefined', () => {
      const result = handleWatchdogVerdict('max-runtime', now)

      expect(result.taskUpdate?.notes).toContain('60 minutes')
    })
  })

  describe('idle verdict', () => {
    it('returns error status with terminal notification', () => {
      const result = handleWatchdogVerdict('idle', now)

      expect(result.shouldNotifyTerminal).toBe(true)
      expect(result.terminalStatus).toBe('error')
      expect(result.taskUpdate).toMatchObject({
        status: 'error',
        completed_at: now,
        claimed_by: null,
        needs_review: true
      })
      expect(result.taskUpdate?.notes).toContain('no output for 15 minutes')
    })
  })

  describe('rate-limit-loop verdict', () => {
    it('returns queued status without terminal notification', () => {
      const result = handleWatchdogVerdict('rate-limit-loop', now)

      expect(result.shouldNotifyTerminal).toBe(false)
      expect(result.shouldRequeue).toBe(true)
      expect(result.taskUpdate).toMatchObject({
        status: 'queued',
        claimed_by: null
      })
      expect(result.taskUpdate?.notes).toContain('rate limits')
    })

    it('does not set terminalStatus', () => {
      const result = handleWatchdogVerdict('rate-limit-loop', now)

      expect(result.terminalStatus).toBeUndefined()
    })
  })

  describe('cost-budget-exceeded verdict', () => {
    it('returns error status with terminal notification', () => {
      const result = handleWatchdogVerdict('cost-budget-exceeded', now)

      expect(result.shouldNotifyTerminal).toBe(true)
      expect(result.terminalStatus).toBe('error')
      expect(result.taskUpdate).toMatchObject({
        status: 'error',
        completed_at: now,
        claimed_by: null,
        needs_review: true
      })
      expect(result.taskUpdate?.notes).toContain('cost budget')
    })
  })

  describe('edge cases', () => {
    it('handles unknown verdict gracefully', () => {
      const result = handleWatchdogVerdict('unknown' as WatchdogAction, now)

      expect(result.taskUpdate).toBeNull()
      expect(result.shouldNotifyTerminal).toBe(false)
    })
  })

  describe('verdict result structure', () => {
    it('all terminal verdicts include taskUpdate', () => {
      const terminalVerdicts: WatchdogAction[] = ['max-runtime', 'idle', 'cost-budget-exceeded']

      for (const verdict of terminalVerdicts) {
        const result = handleWatchdogVerdict(verdict, now)
        expect(result.taskUpdate).not.toBeNull()
        expect(result.shouldNotifyTerminal).toBe(true)
        expect(result.terminalStatus).toBe('error')
      }
    })

    it('rate-limit-loop sets shouldRequeue flag', () => {
      const result = handleWatchdogVerdict('rate-limit-loop', now)

      expect(result.shouldRequeue).toBe(true)
      expect(result.shouldNotifyTerminal).toBe(false)
    })
  })
})
