import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../../stores/toasts', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    undoable: vi.fn()
  }
}))

import { usePrGroups } from '../usePrGroups'
import { usePrGroupsStore } from '../../stores/prGroups'
import { useSprintTasks } from '../../stores/sprintTasks'
import { toast } from '../../stores/toasts'

const stubPrGroupsApi = (): Record<string, ReturnType<typeof vi.fn>> => {
  const api = window.api as Record<string, unknown>
  const stubs = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    addTask: vi.fn().mockResolvedValue({}),
    removeTask: vi.fn().mockResolvedValue({}),
    build: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined)
  }
  api.prGroups = stubs
  return stubs
}

describe('usePrGroups — buildGroup toast behavior', () => {
  let prGroupsApi: Record<string, ReturnType<typeof vi.fn>>
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    usePrGroupsStore.setState({
      groups: [],
      buildingGroupIds: new Set(),
      error: null
    })
    useSprintTasks.setState({
      tasks: []
    } as Partial<ReturnType<typeof useSprintTasks.getState>> as ReturnType<
      typeof useSprintTasks.getState
    >)
    prGroupsApi = stubPrGroupsApi()
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  it('shows an info toast with an Open PR action when build succeeds', async () => {
    prGroupsApi.build.mockResolvedValueOnce({
      success: true,
      prUrl: 'https://github.com/x/pr/9',
      prNumber: 9
    })
    prGroupsApi.list.mockResolvedValue([])

    const { result } = renderHook(() => usePrGroups('fleet'))
    await waitFor(() => expect(prGroupsApi.list).toHaveBeenCalled())

    await act(async () => {
      await result.current.buildGroup('g1')
    })

    expect(toast.info).toHaveBeenCalledTimes(1)
    const [message, options] = vi.mocked(toast.info).mock.calls[0]
    expect(message).toBe('PR created')
    expect(options).toMatchObject({ action: 'Open PR' })
    expect(typeof options?.onAction).toBe('function')

    options?.onAction?.()
    expect(openSpy).toHaveBeenCalledWith('https://github.com/x/pr/9', '_blank')
  })

  it('shows an error toast when build fails', async () => {
    prGroupsApi.build.mockResolvedValueOnce({
      success: false,
      error: 'merge conflict',
      conflictingFiles: ['src/a.ts']
    })
    prGroupsApi.list.mockResolvedValue([])

    const { result } = renderHook(() => usePrGroups('fleet'))
    await waitFor(() => expect(prGroupsApi.list).toHaveBeenCalled())

    await act(async () => {
      await result.current.buildGroup('g1')
    })

    expect(toast.error).toHaveBeenCalledWith('merge conflict')
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('falls back to a generic message when error string is missing', async () => {
    prGroupsApi.build.mockResolvedValueOnce({ success: false })
    prGroupsApi.list.mockResolvedValue([])

    const { result } = renderHook(() => usePrGroups('fleet'))
    await waitFor(() => expect(prGroupsApi.list).toHaveBeenCalled())

    await act(async () => {
      await result.current.buildGroup('g1')
    })

    expect(toast.error).toHaveBeenCalledWith('PR creation failed')
  })
})
