/**
 * Tests for the field-wise equality optimization in sprintTasks.
 * Verifies that poll merges preserve object identity when no mutable fields changed
 * and replace references only when something the UI actually cares about changed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SprintTask } from '../../../../shared/types'
import { nowIso } from '../../../../shared/time'

vi.mock('../toasts', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    undoable: vi.fn()
  }
}))

vi.mock('../../../../shared/template-heuristics', () => ({
  detectTemplate: vi.fn().mockReturnValue(null)
}))

import { useSprintTasks, MUTABLE_TASK_FIELDS } from '../sprintTasks'

function makeTask(id: string, overrides: Partial<SprintTask> = {}): SprintTask {
  return {
    id,
    title: `Task ${id}`,
    repo: 'fleet',
    prompt: null,
    priority: 1,
    status: 'backlog',
    notes: null,
    spec: null,
    retry_count: 0,
    fast_fail_count: 0,
    agent_run_id: null,
    pr_number: null,
    pr_status: null,
    pr_mergeable_state: null,
    pr_url: null,
    claimed_by: null,
    started_at: null,
    completed_at: null,
    template_name: null,
    depends_on: null,
    updated_at: nowIso(),
    created_at: nowIso(),
    ...overrides
  }
}

const initialState = {
  tasks: [] as SprintTask[],
  loading: true,
  loadError: null,
  pollError: null,
  prMergedMap: {},
  pendingUpdates: {} as Record<string, { ts: number; fields: readonly (keyof SprintTask)[] }>,
  pendingCreates: [] as string[]
}

describe('MUTABLE_TASK_FIELDS', () => {
  it('is exported and includes status', () => {
    expect(MUTABLE_TASK_FIELDS).toContain('status')
  })

  it('includes all fields that change during a run', () => {
    const required = ['status', 'claimed_by', 'completed_at', 'pr_status', 'pr_url', 'retry_count', 'notes']
    for (const field of required) {
      expect(MUTABLE_TASK_FIELDS).toContain(field)
    }
  })
})

describe('poll-merge field-wise equality', () => {
  beforeEach(() => {
    useSprintTasks.setState(initialState)
    vi.clearAllMocks()
    const sprint = window.api.sprint as unknown as Record<string, ReturnType<typeof vi.fn>>
    sprint.list.mockResolvedValue([])
  })

  it('preserves object identity when all mutable fields are unchanged', async () => {
    const task = makeTask('t1', { status: 'active', claimed_by: 'agent-xyz' })
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([task])

    await useSprintTasks.getState().loadData()
    const firstRef = useSprintTasks.getState().tasks[0]

    // Second poll — same data, same updated_at
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([{ ...task }])
    await useSprintTasks.getState().loadData()

    const secondRef = useSprintTasks.getState().tasks[0]
    expect(secondRef).toBe(firstRef)
  })

  it('replaces object reference when status changes', async () => {
    const task = makeTask('t1', { status: 'queued', updated_at: '2026-01-01T00:00:00.000Z' })
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([task])

    await useSprintTasks.getState().loadData()
    const firstRef = useSprintTasks.getState().tasks[0]

    // Second poll — status changed, updated_at also changed
    const updatedTask = { ...task, status: 'active' as const, updated_at: '2026-01-01T00:00:01.000Z' }
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([updatedTask])
    await useSprintTasks.getState().loadData()

    const secondRef = useSprintTasks.getState().tasks[0]
    expect(secondRef).not.toBe(firstRef)
    expect(secondRef.status).toBe('active')
  })

  it('preserves object identity when revision_feedback arrays are structurally equal', async () => {
    const feedback = [{ timestamp: '2026-01-01', feedback: 'fix tests', attempt: 1 }]
    const task = makeTask('t1', { revision_feedback: feedback })
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([task])

    await useSprintTasks.getState().loadData()
    const firstRef = useSprintTasks.getState().tasks[0]

    // Different array instance with structurally identical contents — must preserve reference
    const sameContents = [{ timestamp: '2026-01-01', feedback: 'fix tests', attempt: 1 }]
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...task, revision_feedback: sameContents }
    ])
    await useSprintTasks.getState().loadData()

    expect(useSprintTasks.getState().tasks[0]).toBe(firstRef)
  })

  it('replaces object reference when a revision_feedback entry changes', async () => {
    const task = makeTask('t1', {
      revision_feedback: [{ timestamp: '2026-01-01', feedback: 'first', attempt: 1 }],
      updated_at: '2026-01-01T00:00:00.000Z'
    })
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([task])
    await useSprintTasks.getState().loadData()
    const firstRef = useSprintTasks.getState().tasks[0]

    const updatedTask = {
      ...task,
      revision_feedback: [{ timestamp: '2026-01-01', feedback: 'changed', attempt: 1 }],
      updated_at: '2026-01-01T00:00:01.000Z'
    }
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([updatedTask])
    await useSprintTasks.getState().loadData()

    expect(useSprintTasks.getState().tasks[0]).not.toBe(firstRef)
    expect(useSprintTasks.getState().tasks[0].revision_feedback?.[0]?.feedback).toBe('changed')
  })

  it('replaces object reference when a revision_feedback entry is appended', async () => {
    const task = makeTask('t1', {
      revision_feedback: [{ timestamp: '2026-01-01', feedback: 'first', attempt: 1 }],
      updated_at: '2026-01-01T00:00:00.000Z'
    })
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([task])
    await useSprintTasks.getState().loadData()
    const firstRef = useSprintTasks.getState().tasks[0]

    const updatedTask = {
      ...task,
      revision_feedback: [
        { timestamp: '2026-01-01', feedback: 'first', attempt: 1 },
        { timestamp: '2026-01-02', feedback: 'second', attempt: 2 }
      ],
      updated_at: '2026-01-01T00:00:01.000Z'
    }
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([updatedTask])
    await useSprintTasks.getState().loadData()

    expect(useSprintTasks.getState().tasks[0]).not.toBe(firstRef)
    expect(useSprintTasks.getState().tasks[0].revision_feedback).toHaveLength(2)
  })

  it('replaces object reference when pr_status changes', async () => {
    const task = makeTask('t1', { status: 'done', pr_status: null, updated_at: '2026-01-01T00:00:00.000Z' })
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([task])

    await useSprintTasks.getState().loadData()
    const firstRef = useSprintTasks.getState().tasks[0]

    const updatedTask = { ...task, pr_status: 'open' as const, updated_at: '2026-01-01T00:00:01.000Z' }
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([updatedTask])
    await useSprintTasks.getState().loadData()

    expect(useSprintTasks.getState().tasks[0]).not.toBe(firstRef)
    expect(useSprintTasks.getState().tasks[0].pr_status).toBe('open')
  })
})

describe('pollError', () => {
  beforeEach(() => {
    useSprintTasks.setState(initialState)
    vi.clearAllMocks()
  })

  it('is null on initial state', () => {
    expect(useSprintTasks.getState().pollError).toBeNull()
  })

  it('is set when loadData IPC call fails', async () => {
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'))

    await useSprintTasks.getState().loadData()

    expect(useSprintTasks.getState().pollError).toMatch(/network down/)
  })

  it('is cleared when loadData succeeds after a failure', async () => {
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('oops'))
    await useSprintTasks.getState().loadData()
    expect(useSprintTasks.getState().pollError).not.toBeNull()

    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await useSprintTasks.getState().loadData()

    expect(useSprintTasks.getState().pollError).toBeNull()
  })

  it('clearPollError sets pollError to null', async () => {
    ;(window.api.sprint.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('oops'))
    await useSprintTasks.getState().loadData()

    useSprintTasks.getState().clearPollError()

    expect(useSprintTasks.getState().pollError).toBeNull()
  })
})
