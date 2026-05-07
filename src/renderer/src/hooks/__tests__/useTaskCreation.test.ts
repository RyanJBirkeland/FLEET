import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUpdateTask = vi.fn().mockResolvedValue(undefined)
const mockCreateTask = vi.fn().mockResolvedValue('new-task-id')
const mockSetOperationalChecks = vi.fn()

vi.mock('../../stores/sprintTasks', () => ({
  useSprintTasks: Object.assign((selector: any) => selector({ updateTask: mockUpdateTask }), {
    setState: vi.fn(),
    getState: () => ({ updateTask: mockUpdateTask })
  })
}))

vi.mock('../useSprintTaskActions', () => ({
  useSprintTaskActions: () => ({ createTask: mockCreateTask })
}))

vi.mock('../../stores/taskWorkbench', () => ({
  useTaskWorkbenchStore: { setState: vi.fn() }
}))

const validationState = {
  setOperationalChecks: mockSetOperationalChecks,
  structuralChecks: [] as Array<{ status: string; label: string; message: string }>,
  semanticChecks: [] as Array<{ status: string; label: string; message: string }>
}

vi.mock('../../stores/taskWorkbenchValidation', () => ({
  useTaskWorkbenchValidation: Object.assign((selector: any) => selector(validationState), {
    setState: vi.fn()
  })
}))

import { useTaskCreation, type TaskCreationFormData } from '../useTaskCreation'

const baseFormData: TaskCreationFormData = {
  title: 'Test',
  repo: 'fleet',
  priority: 1,
  spec: '## h1\n## h2',
  specType: 'feature',
  dependsOn: [],
  playgroundEnabled: false,
  maxCostUsd: null,
  model: '',
  pendingGroupId: null,
  crossRepoContract: null
}

const allPassChecks = {
  auth: { status: 'pass', message: 'ok' },
  repoPath: { status: 'pass', message: 'ok' },
  gitClean: { status: 'pass', message: 'ok' },
  noConflict: { status: 'pass', message: 'ok' },
  slotsAvailable: { status: 'pass', message: 'ok' }
}

function stubCheckOperational(result: any): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue(result)
  ;(window as any).api = {
    ...((window as any).api ?? {}),
    workbench: { checkOperational: fn }
  }
  return fn
}

describe('useTaskCreation.save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validationState.structuralChecks = []
    validationState.semanticChecks = []
  })

  it('returns blocked when an operational check fails', async () => {
    stubCheckOperational({
      ...allPassChecks,
      gitClean: { status: 'fail', message: 'dirty working tree' }
    })

    const { result } = renderHook(() =>
      useTaskCreation({ mode: 'create', taskId: null, formData: baseFormData })
    )

    let outcome
    await act(async () => {
      outcome = await result.current.save('queued')
    })

    expect(outcome).toEqual({ outcome: 'blocked' })
    expect(mockCreateTask).not.toHaveBeenCalled()
    expect(mockUpdateTask).not.toHaveBeenCalled()
  })

  it('returns confirm when operational checks have warnings', async () => {
    stubCheckOperational({
      ...allPassChecks,
      gitClean: { status: 'warn', message: 'untracked files' }
    })

    const { result } = renderHook(() =>
      useTaskCreation({ mode: 'create', taskId: null, formData: baseFormData })
    )

    let outcome: any
    await act(async () => {
      outcome = await result.current.save('queued')
    })

    expect(outcome.outcome).toBe('confirm')
    expect(outcome.confirmMessage).toContain('warnings')
    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('returns ok and creates+queues a new task when all checks pass', async () => {
    stubCheckOperational(allPassChecks)

    const { result } = renderHook(() =>
      useTaskCreation({ mode: 'create', taskId: null, formData: baseFormData })
    )

    let outcome
    await act(async () => {
      outcome = await result.current.save('queued')
    })

    expect(outcome).toEqual({ outcome: 'ok' })
    expect(mockCreateTask).toHaveBeenCalledTimes(1)
    expect(mockUpdateTask).toHaveBeenCalledWith('new-task-id', { status: 'queued' })
  })

  it('saveConfirmed proceeds without re-running operational checks', async () => {
    const checkSpy = stubCheckOperational(allPassChecks)

    const { result } = renderHook(() =>
      useTaskCreation({ mode: 'create', taskId: null, formData: baseFormData })
    )

    await act(async () => {
      await result.current.saveConfirmed('queued')
    })

    expect(checkSpy).not.toHaveBeenCalled()
    expect(mockCreateTask).toHaveBeenCalledTimes(1)
    expect(mockUpdateTask).toHaveBeenCalledWith('new-task-id', { status: 'queued' })
  })
})
