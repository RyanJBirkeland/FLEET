import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockCheckFreshness = vi.fn()

vi.mock('../../services/review', () => ({
  checkFreshness: (args: any) => mockCheckFreshness(args)
}))

import { useReviewFreshness } from '../useReviewFreshness'

describe('useReviewFreshness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets the freshness result on a successful fetch', async () => {
    mockCheckFreshness.mockResolvedValue({ status: 'fresh', commitsBehind: 0 })

    const { result } = renderHook(() => useReviewFreshness('task-1', 'review', null))

    await waitFor(() => {
      expect(result.current.freshness.status).toBe('fresh')
    })
    expect(result.current.freshness.commitsBehind).toBe(0)
  })

  it("sets status to 'unknown' when the fetch rejects", async () => {
    mockCheckFreshness.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useReviewFreshness('task-1', 'review', null))

    await waitFor(() => {
      expect(result.current.freshness.status).toBe('unknown')
    })
  })

  it('does not call setState when the hook unmounts before the fetch resolves', async () => {
    let resolveFn: (value: { status: string; commitsBehind: number }) => void = () => {}
    mockCheckFreshness.mockImplementationOnce(() => new Promise((resolve) => (resolveFn = resolve)))

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { unmount } = renderHook(() => useReviewFreshness('task-1', 'review', null))
    unmount()

    // Resolve after unmount — the cancelled flag in the hook should suppress setState.
    resolveFn({ status: 'fresh', commitsBehind: 0 })
    await Promise.resolve()
    await Promise.resolve()

    // No "can't perform a React state update on an unmounted component" warning should fire.
    const warnings = [...errorSpy.mock.calls, ...warnSpy.mock.calls].flat().join(' ')
    expect(warnings).not.toMatch(/unmounted component|memory leak/i)

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })
})
