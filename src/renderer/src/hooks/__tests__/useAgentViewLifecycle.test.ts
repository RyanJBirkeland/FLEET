import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAgentViewLifecycle } from '../useAgentViewLifecycle'

describe('useAgentViewLifecycle — fleet:open-spawn-modal listener', () => {
  let addSpy: ReturnType<typeof vi.spyOn>
  let removeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener')
    removeSpy = vi.spyOn(window, 'removeEventListener')
  })

  it('registers a fleet:open-spawn-modal listener on mount and removes it on unmount', () => {
    const fetchAgents = vi.fn()
    const loadHistory = vi.fn().mockResolvedValue(undefined)
    const setShowLaunchpad = vi.fn()

    const { unmount } = renderHook(() =>
      useAgentViewLifecycle({
        activeView: 'agents',
        activeId: null,
        fetchAgents,
        loadHistory,
        setShowLaunchpad
      })
    )

    const addCall = addSpy.mock.calls.find((c) => c[0] === 'fleet:open-spawn-modal')
    expect(addCall).toBeDefined()
    const handler = addCall![1]

    unmount()

    const removeCall = removeSpy.mock.calls.find((c) => c[0] === 'fleet:open-spawn-modal')
    expect(removeCall).toBeDefined()
    expect(removeCall![1]).toBe(handler)
  })
})
