import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PrGroup, SprintTask } from '../../../../shared/types/task-types'
import { nowIso } from '../../../../shared/time'

import {
  usePrGroupsStore,
  selectUnassignedApprovedTasks,
  selectGroupsForRepo
} from '../prGroups'

const makePrGroup = (id: string, overrides: Partial<PrGroup> = {}): PrGroup => ({
  id,
  repo: 'fleet',
  title: `Group ${id}`,
  branch_name: `rollup/${id}`,
  description: null,
  status: 'composing',
  task_order: [],
  pr_number: null,
  pr_url: null,
  created_at: nowIso(),
  updated_at: nowIso(),
  ...overrides
})

const makeTask = (id: string, overrides: Partial<SprintTask> = {}): SprintTask => ({
  id,
  title: `Task ${id}`,
  repo: 'fleet',
  prompt: null,
  priority: 1,
  status: 'approved',
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
})

const initialState = {
  groups: [] as PrGroup[],
  buildingGroupIds: new Set<string>(),
  error: null as string | null
}

const stubPrGroupsApi = (): Record<string, ReturnType<typeof vi.fn>> => {
  const api = window.api as Record<string, unknown>
  const stubs = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(makePrGroup('new')),
    update: vi.fn().mockResolvedValue(makePrGroup('updated')),
    addTask: vi.fn().mockResolvedValue(makePrGroup('added')),
    removeTask: vi.fn().mockResolvedValue(makePrGroup('removed')),
    build: vi.fn().mockResolvedValue({ success: true, prUrl: 'https://github.com/x/pr/1', prNumber: 1 }),
    delete: vi.fn().mockResolvedValue(undefined)
  }
  api.prGroups = stubs
  return stubs
}

describe('prGroups store', () => {
  let prGroupsApi: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    usePrGroupsStore.setState(initialState)
    vi.clearAllMocks()
    prGroupsApi = stubPrGroupsApi()
  })

  describe('selectors', () => {
    describe('selectUnassignedApprovedTasks', () => {
      it('returns approved tasks in repo not assigned to any group', () => {
        const tasks = [
          makeTask('t1', { status: 'approved', repo: 'fleet' }),
          makeTask('t2', { status: 'approved', repo: 'fleet' }),
          makeTask('t3', { status: 'review', repo: 'fleet' }), // wrong status
          makeTask('t4', { status: 'approved', repo: 'other' }) // wrong repo
        ]
        const groups = [makePrGroup('g1', { task_order: ['t2'] })]

        const result = selectUnassignedApprovedTasks(tasks, groups, 'fleet')

        expect(result.map((t) => t.id)).toEqual(['t1'])
      })

      it('returns empty when all approved tasks are assigned', () => {
        const tasks = [makeTask('t1', { status: 'approved' })]
        const groups = [makePrGroup('g1', { task_order: ['t1'] })]
        expect(selectUnassignedApprovedTasks(tasks, groups, 'fleet')).toEqual([])
      })
    })

    describe('selectGroupsForRepo', () => {
      it('filters groups by repo', () => {
        const groups = [
          makePrGroup('g1', { repo: 'fleet' }),
          makePrGroup('g2', { repo: 'other' }),
          makePrGroup('g3', { repo: 'fleet' })
        ]
        const result = selectGroupsForRepo(groups, 'fleet')
        expect(result.map((g) => g.id)).toEqual(['g1', 'g3'])
      })
    })
  })

  describe('createGroup', () => {
    it('inserts the new group at the head of the list on success', async () => {
      const existing = makePrGroup('existing')
      usePrGroupsStore.setState({ ...initialState, groups: [existing] })

      const created = makePrGroup('new', { title: 'Brand New' })
      prGroupsApi.create.mockResolvedValueOnce(created)

      const result = await usePrGroupsStore
        .getState()
        .createGroup('fleet', 'Brand New', 'rollup/new', 'desc')

      expect(result).toEqual(created)
      expect(prGroupsApi.create).toHaveBeenCalledWith({
        repo: 'fleet',
        title: 'Brand New',
        branchName: 'rollup/new',
        description: 'desc'
      })
      const groupsAfter = usePrGroupsStore.getState().groups
      expect(groupsAfter.map((g) => g.id)).toEqual(['new', 'existing'])
    })
  })

  describe('addTask', () => {
    it('replaces the matching group with the server response', async () => {
      const before = makePrGroup('g1', { task_order: [] })
      usePrGroupsStore.setState({ ...initialState, groups: [before] })

      const after = makePrGroup('g1', { task_order: ['t1'] })
      prGroupsApi.addTask.mockResolvedValueOnce(after)

      await usePrGroupsStore.getState().addTask('g1', 't1')

      expect(prGroupsApi.addTask).toHaveBeenCalledWith({ groupId: 'g1', taskId: 't1' })
      expect(usePrGroupsStore.getState().groups[0].task_order).toEqual(['t1'])
    })
  })

  describe('removeTask', () => {
    it('replaces the matching group with the server response', async () => {
      const before = makePrGroup('g1', { task_order: ['t1', 't2'] })
      usePrGroupsStore.setState({ ...initialState, groups: [before] })

      const after = makePrGroup('g1', { task_order: ['t2'] })
      prGroupsApi.removeTask.mockResolvedValueOnce(after)

      await usePrGroupsStore.getState().removeTask('g1', 't1')

      expect(prGroupsApi.removeTask).toHaveBeenCalledWith({ groupId: 'g1', taskId: 't1' })
      expect(usePrGroupsStore.getState().groups[0].task_order).toEqual(['t2'])
    })
  })

  describe('buildGroup', () => {
    it('returns prUrl on success and reloads groups', async () => {
      prGroupsApi.build.mockResolvedValueOnce({
        success: true,
        prUrl: 'https://github.com/x/pr/42',
        prNumber: 42
      })
      prGroupsApi.list.mockResolvedValueOnce([makePrGroup('g1', { status: 'open' })])

      const result = await usePrGroupsStore.getState().buildGroup('g1')

      expect(result).toEqual({ success: true, prUrl: 'https://github.com/x/pr/42' })
      expect(prGroupsApi.list).toHaveBeenCalledOnce()
      expect(usePrGroupsStore.getState().buildingGroupIds.has('g1')).toBe(false)
    })

    it('propagates conflictingFiles on failure', async () => {
      prGroupsApi.build.mockResolvedValueOnce({
        success: false,
        error: 'merge conflict',
        conflictingFiles: ['src/a.ts', 'src/b.ts']
      })

      const result = await usePrGroupsStore.getState().buildGroup('g1')

      expect(result).toEqual({
        success: false,
        error: 'merge conflict',
        conflictingFiles: ['src/a.ts', 'src/b.ts']
      })
      // No reload on failure
      expect(prGroupsApi.list).not.toHaveBeenCalled()
      expect(usePrGroupsStore.getState().buildingGroupIds.has('g1')).toBe(false)
    })
  })

  describe('deleteGroup', () => {
    it('optimistically removes the group from the list', async () => {
      const g1 = makePrGroup('g1')
      const g2 = makePrGroup('g2')
      usePrGroupsStore.setState({ ...initialState, groups: [g1, g2] })

      await usePrGroupsStore.getState().deleteGroup('g1')

      expect(prGroupsApi.delete).toHaveBeenCalledWith({ id: 'g1' })
      expect(usePrGroupsStore.getState().groups.map((g) => g.id)).toEqual(['g2'])
    })
  })
})
