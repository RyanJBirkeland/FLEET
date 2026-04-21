import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDrainStatus } from '../useDrainStatus'

type PausedEvent = { reason: string; pausedUntil: number; affectedTaskCount: number }

function apiAgentManager(): { onDrainPaused: ReturnType<typeof vi.fn> } {
  return (
    globalThis as unknown as {
      api: { agentManager: { onDrainPaused: ReturnType<typeof vi.fn> } }
    }
  ).api.agentManager
}

describe('useDrainStatus', () => {
  beforeEach(() => {
    apiAgentManager().onDrainPaused = vi.fn().mockReturnValue(() => {})
  })

  it('subscribes on mount and returns null before any event', () => {
    const unsubscribe = vi.fn()
    apiAgentManager().onDrainPaused = vi.fn().mockReturnValue(unsubscribe)

    const { result, unmount } = renderHook(() => useDrainStatus())
    expect(result.current).toBeNull()
    expect(apiAgentManager().onDrainPaused).toHaveBeenCalledTimes(1)

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('surfaces the event and clears when pausedUntil elapses', () => {
    vi.useFakeTimers()
    let emit: (event: PausedEvent) => void = () => {}
    apiAgentManager().onDrainPaused = vi.fn((cb: (event: PausedEvent) => void) => {
      emit = cb
      return () => {}
    })

    const now = Date.now()
    const { result } = renderHook(() => useDrainStatus())
    act(() => {
      emit({ reason: 'Main repo dirty', pausedUntil: now + 10_000, affectedTaskCount: 3 })
    })
    expect(result.current?.reason).toBe('Main repo dirty')
    act(() => {
      vi.advanceTimersByTime(10_500)
    })
    expect(result.current).toBeNull()
    vi.useRealTimers()
  })
})
