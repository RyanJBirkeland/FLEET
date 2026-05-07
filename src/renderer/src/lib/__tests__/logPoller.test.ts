import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createLogPollerActions, type LogPollerState } from '../logPoller'
import { MAX_LOG_LINES } from '../constants'

describe('createLogPollerActions — MAX_LOG_LINES trim path', () => {
  let state: LogPollerState

  beforeEach(() => {
    vi.useFakeTimers()
    state = { logContent: '', logNextByte: 0, logTrimmedLines: 0 }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('caps logContent at MAX_LOG_LINES and increments logTrimmedLines by the excess count', async () => {
    const overflow = 50
    const totalLines = MAX_LOG_LINES + overflow
    const content = Array.from({ length: totalLines }, (_, i) => `line-${i}`).join('\n')

    const get = (): LogPollerState => state
    const set = (partial: Partial<LogPollerState>): void => {
      state = { ...state, ...partial }
    }

    const readFn = vi.fn().mockResolvedValueOnce({ content, nextByte: content.length })
    const { startLogPolling, stopLogPolling } = createLogPollerActions(get, set)

    const stop = startLogPolling(readFn)
    // The first poll() runs synchronously inside start; await microtasks
    await vi.runOnlyPendingTimersAsync()
    await Promise.resolve()
    await Promise.resolve()
    stop()
    stopLogPolling()

    const lines = state.logContent.split('\n')
    expect(lines.length).toBe(MAX_LOG_LINES)
    expect(state.logTrimmedLines).toBe(overflow)
    expect(state.logNextByte).toBe(content.length)
  })
})
