import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFilteredTasks } from '../useFilteredTasks'
import { useSprintTasks } from '../../stores/sprintTasks'
import { useSprintFilters, type StatusFilter } from '../../stores/sprintFilters'
import type { SprintTask } from '../../../../shared/types'
import type { SprintPartition } from '../../lib/partitionSprintTasks'

function makeTask(
  id: string,
  status: SprintTask['status'],
  extras: Partial<SprintTask> = {}
): SprintTask {
  return {
    id,
    title: `Task ${id}`,
    status,
    repo: 'fleet',
    priority: 1,
    needs_review: false,
    spec: null,
    spec_type: null,
    prompt: null,
    tags: null,
    depends_on: null,
    pr_url: null,
    pr_number: null,
    pr_status: null,
    agent_run_id: null,
    started_at: null,
    completed_at: null,
    failure_reason: null,
    retry_count: 0,
    ...extras
  } as unknown as SprintTask
}

// Cover every partition bucket so each filter branch has at least one task to zero out.
const everyBucketTasks: SprintTask[] = [
  makeTask('b1', 'backlog'),
  makeTask('q1', 'queued'),
  makeTask('bl1', 'blocked'),
  makeTask('a1', 'active'),
  makeTask('a2', 'active', { pr_status: 'open' }),
  makeTask('r1', 'review'),
  makeTask('ap1', 'approved'),
  makeTask('d1', 'done'),
  makeTask('f1', 'failed')
]

function setStatusFilter(filter: StatusFilter): void {
  useSprintFilters.setState({
    statusFilter: filter,
    repoFilter: null,
    tagFilter: null,
    searchQuery: ''
  })
}

const ZEROED_BY_FILTER: Record<Exclude<StatusFilter, 'all'>, (keyof SprintPartition)[]> = {
  backlog: ['todo', 'blocked', 'inProgress', 'pendingReview', 'openPrs', 'done', 'failed'],
  todo: ['backlog', 'blocked', 'inProgress', 'pendingReview', 'openPrs', 'done', 'failed'],
  blocked: ['backlog', 'todo', 'inProgress', 'pendingReview', 'openPrs', 'done', 'failed'],
  'in-progress': ['backlog', 'todo', 'blocked', 'pendingReview', 'openPrs', 'done', 'failed'],
  review: ['backlog', 'todo', 'blocked', 'inProgress', 'openPrs', 'done', 'failed'],
  'open-prs': ['backlog', 'todo', 'blocked', 'inProgress', 'pendingReview', 'done', 'failed'],
  done: ['backlog', 'todo', 'blocked', 'inProgress', 'pendingReview', 'openPrs', 'failed'],
  failed: ['backlog', 'todo', 'blocked', 'inProgress', 'pendingReview', 'openPrs', 'done']
}

const KEPT_BY_FILTER: Record<Exclude<StatusFilter, 'all'>, keyof SprintPartition> = {
  backlog: 'backlog',
  todo: 'todo',
  blocked: 'blocked',
  'in-progress': 'inProgress',
  review: 'pendingReview',
  'open-prs': 'openPrs',
  done: 'done',
  failed: 'failed'
}

describe('useFilteredTasks — status-filter switch branches', () => {
  beforeEach(() => {
    useSprintTasks.setState({ tasks: everyBucketTasks } as Partial<
      ReturnType<typeof useSprintTasks.getState>
    > as ReturnType<typeof useSprintTasks.getState>)
    setStatusFilter('all')
  })

  it("'all' returns the unmodified partition", () => {
    setStatusFilter('all')
    const { result } = renderHook(() => useFilteredTasks())
    expect(result.current.filteredPartition).toBe(result.current.partition)
  })

  for (const filter of Object.keys(ZEROED_BY_FILTER) as Exclude<StatusFilter, 'all'>[]) {
    it(`filter='${filter}' zeroes the other buckets and keeps ${KEPT_BY_FILTER[filter]}`, () => {
      setStatusFilter(filter)
      const { result } = renderHook(() => useFilteredTasks())
      const partition = result.current.filteredPartition

      for (const zeroed of ZEROED_BY_FILTER[filter]) {
        expect(partition[zeroed]).toEqual([])
      }

      expect(partition[KEPT_BY_FILTER[filter]].length).toBeGreaterThan(0)
    })
  }
})
