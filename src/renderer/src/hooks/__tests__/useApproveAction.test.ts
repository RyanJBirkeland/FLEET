import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockApproveTask = vi.fn()

vi.mock('../../services/review', () => ({
  approveTask: (args: any) => mockApproveTask(args)
}))

vi.mock('../../stores/toasts', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

import { useApproveAction } from '../useApproveAction'

describe('useApproveAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets inFlight to false after a rejected API call (finally block runs)', async () => {
    mockApproveTask.mockRejectedValueOnce(new Error('approve failed'))
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useApproveAction('task-1', onSuccess))

    expect(result.current.inFlight).toBe(false)

    await act(async () => {
      await result.current.approve()
    })

    await waitFor(() => {
      expect(result.current.inFlight).toBe(false)
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('also resets inFlight after a successful approve', async () => {
    mockApproveTask.mockResolvedValueOnce(undefined)
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useApproveAction('task-1', onSuccess))

    await act(async () => {
      await result.current.approve()
    })

    expect(result.current.inFlight).toBe(false)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })
})
