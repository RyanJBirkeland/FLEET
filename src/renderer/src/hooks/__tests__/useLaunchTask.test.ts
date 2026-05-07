import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUpdateTask = vi.fn().mockResolvedValue(undefined)
let activeCountStub = 0

vi.mock('../../stores/sprintTasks', () => {
  const SENTINEL = Symbol('selectActiveTaskCount')
  const selectActiveTaskCount = Object.assign(() => activeCountStub, { __sentinel: SENTINEL })
  const useSprintTasks: any = (selector: any) => {
    if (selector === selectActiveTaskCount) return activeCountStub
    return selector({ updateTask: mockUpdateTask })
  }
  useSprintTasks.setState = vi.fn()
  useSprintTasks.getState = (): any => ({ updateTask: mockUpdateTask })
  return { useSprintTasks, selectActiveTaskCount }
})

vi.mock('../../stores/toasts', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

const mockGetRepoPaths = vi.fn()
const mockSpawnLocal = vi.fn()

vi.mock('../../services/git', () => ({
  getRepoPaths: () => mockGetRepoPaths()
}))

vi.mock('../../services/agents', () => ({
  spawnLocal: (args: any) => mockSpawnLocal(args)
}))

import { useLaunchTask } from '../useLaunchTask'
import { toast } from '../../stores/toasts'
import { WIP_LIMIT_IN_PROGRESS } from '../../lib/constants'

const queuedTask = {
  id: 'queued-task',
  status: 'queued',
  repo: 'fleet',
  spec: 'spec',
  title: 'Title'
} as any

describe('useLaunchTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeCountStub = 0
    mockGetRepoPaths.mockResolvedValue({ fleet: '/path/to/fleet' })
    mockSpawnLocal.mockResolvedValue({ id: 'agent-1' })
  })

  it('toasts an error when WIP is full and does NOT call spawnLocal', async () => {
    activeCountStub = WIP_LIMIT_IN_PROGRESS
    const { result } = renderHook(() => useLaunchTask())
    await act(async () => {
      await result.current(queuedTask)
    })

    expect(toast.error).toHaveBeenCalled()
    const message = (toast.error as any).mock.calls[0][0] as string
    expect(message).toContain('In Progress is full')
    expect(mockSpawnLocal).not.toHaveBeenCalled()
  })

  it('toasts an error when no repo path is configured', async () => {
    mockGetRepoPaths.mockResolvedValueOnce({})
    const { result } = renderHook(() => useLaunchTask())
    await act(async () => {
      await result.current(queuedTask)
    })

    expect(toast.error).toHaveBeenCalledWith('No repo path configured for "fleet"')
    expect(mockSpawnLocal).not.toHaveBeenCalled()
  })

  it('toasts the error message when spawnLocal rejects', async () => {
    mockSpawnLocal.mockRejectedValueOnce(new Error('spawn failed'))
    const { result } = renderHook(() => useLaunchTask())
    await act(async () => {
      await result.current(queuedTask)
    })

    expect(toast.error).toHaveBeenCalledWith('spawn failed')
  })
})
