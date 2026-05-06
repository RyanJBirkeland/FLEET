import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBatchReviewActions } from '../useBatchReviewActions'
import { useCodeReviewStore } from '../../stores/codeReview'
import { useSprintTasks } from '../../stores/sprintTasks'
import { toast } from '../../stores/toasts'

vi.mock('../../stores/codeReview')
vi.mock('../../stores/sprintTasks')
vi.mock('../../stores/toasts', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

const taskA = { id: 'task-a', title: 'Task A' }
const taskB = { id: 'task-b', title: 'Task B' }
const tasks = [taskA, taskB]

function setupStores(): { mockClearBatch: ReturnType<typeof vi.fn>; mockLoadData: ReturnType<typeof vi.fn> } {
  const mockClearBatch = vi.fn()
  const mockLoadData = vi.fn()

  vi.mocked(useSprintTasks).mockImplementation((selector: any) =>
    selector({ tasks, loadData: mockLoadData })
  )
  ;(useCodeReviewStore as unknown as { getState: () => unknown }).getState = vi
    .fn()
    .mockReturnValue({ clearBatch: mockClearBatch })

  return { mockClearBatch, mockLoadData }
}

function setShipBatchResponse(response: unknown): void {
  global.window.api = {
    review: {
      shipBatch: vi.fn().mockResolvedValue(response)
    }
  } as any
}

describe('useBatchReviewActions.batchShipIt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('on all-success: clears batch, reloads data, shows success toast with shipped count', async () => {
    const { mockClearBatch, mockLoadData } = setupStores()
    setShipBatchResponse({
      success: true,
      pushed: true,
      shippedTaskIds: [taskA.id, taskB.id]
    })

    const { result } = renderHook(() => useBatchReviewActions())

    await act(async () => {
      await result.current.batchShipIt(tasks)
    })

    expect(window.api.review.shipBatch).toHaveBeenCalledWith({
      taskIds: [taskA.id, taskB.id],
      strategy: 'squash'
    })
    expect(mockClearBatch).toHaveBeenCalled()
    expect(mockLoadData).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Shipped 2 tasks')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('on partial-failure: shows error toast naming the failed task id', async () => {
    setupStores()
    setShipBatchResponse({
      success: false,
      shippedTaskIds: [taskA.id],
      failedTaskId: taskB.id,
      error: 'merge conflict'
    })

    const { result } = renderHook(() => useBatchReviewActions())

    await act(async () => {
      await result.current.batchShipIt(tasks)
    })

    expect(toast.error).toHaveBeenCalledWith(
      `Shipped 1, batch aborted (task ${taskB.id}): merge conflict`
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('on pure-failure (none shipped, no failedTaskId): shows generic error toast', async () => {
    setupStores()
    setShipBatchResponse({
      success: false,
      shippedTaskIds: [],
      error: 'auth failed'
    })

    const { result } = renderHook(() => useBatchReviewActions())

    await act(async () => {
      await result.current.batchShipIt(tasks)
    })

    expect(toast.error).toHaveBeenCalledWith('Shipped 0, batch aborted: auth failed')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('on empty input: clears batch without invoking shipBatch', async () => {
    const { mockClearBatch } = setupStores()
    setShipBatchResponse({ success: true, pushed: true, shippedTaskIds: [] })

    const { result } = renderHook(() => useBatchReviewActions())

    await act(async () => {
      await result.current.batchShipIt([])
    })

    expect(window.api.review.shipBatch).not.toHaveBeenCalled()
    expect(mockClearBatch).toHaveBeenCalled()
  })
})
