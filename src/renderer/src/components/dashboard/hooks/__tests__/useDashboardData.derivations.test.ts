import { describe, it, expect } from 'vitest'
import {
  buildBriefHeadlineParts,
  deriveAttentionItems,
  derivePerAgentStats,
  derivePerRepoStats
} from '../useDashboardData'
import type { SprintTask } from '../../../../../../shared/types'
import type { AgentCostRecord } from '../../../../../../shared/types/agent-types'
import type { SprintPartition } from '../../../../lib/partitionSprintTasks'
import { nowIso } from '../../../../../../shared/time'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<SprintTask> = {}): SprintTask {
  return {
    id: crypto.randomUUID(),
    title: 'Test task',
    repo: 'fleet',
    prompt: null,
    priority: 1,
    status: 'queued',
    notes: null,
    spec: null,
    agent_run_id: null,
    pr_number: null,
    pr_status: null,
    pr_mergeable_state: null,
    pr_url: null,
    stacked_on_task_id: null,
    claimed_by: null,
    started_at: null,
    completed_at: null,
    retry_count: 0,
    fast_fail_count: 0,
    template_name: null,
    depends_on: null,
    updated_at: nowIso(),
    created_at: nowIso(),
    ...overrides
  }
}

function makeAgent(overrides: Partial<AgentCostRecord> = {}): AgentCostRecord {
  return {
    id: crypto.randomUUID(),
    model: 'claude-3-5-sonnet',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    costUsd: 0.5,
    tokensIn: 1000,
    tokensOut: 500,
    cacheRead: null,
    cacheCreate: null,
    durationMs: 60000,
    numTurns: 5,
    taskTitle: 'Test task',
    prUrl: null,
    repo: 'fleet',
    sprintTaskId: null,
    ...overrides
  }
}

function makePartition(overrides: Partial<SprintPartition> = {}): SprintPartition {
  return {
    backlog: [],
    todo: [],
    blocked: [],
    inProgress: [],
    pendingReview: [],
    approved: [],
    openPrs: [],
    done: [],
    failed: [],
    ...overrides
  }
}

const STALE_REVIEW_THRESHOLD_MS = 2 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// buildBriefHeadlineParts
// ---------------------------------------------------------------------------

describe('buildBriefHeadlineParts', () => {
  it('returns all-quiet text when nothing is active', () => {
    const parts = buildBriefHeadlineParts(0, 0, 0)
    expect(parts).toHaveLength(1)
    expect(parts[0]).toEqual({ kind: 'text', text: 'All quiet. No agents running.' })
  })

  it('uses singular "agent working" when active count is 1', () => {
    const parts = buildBriefHeadlineParts(1, 0, 0)
    const text = parts.map((p) => p.text).join('')
    expect(text).toContain('1')
    expect(text).toContain(' agent working')
    expect(text).not.toContain(' agents working')
  })

  it('uses plural "agents working" when active count is 3', () => {
    const parts = buildBriefHeadlineParts(3, 0, 0)
    const text = parts.map((p) => p.text).join('')
    expect(text).toContain('3')
    expect(text).toContain(' agents working')
  })

  it('includes "2 reviews waiting on you"', () => {
    const parts = buildBriefHeadlineParts(0, 2, 0)
    const text = parts.map((p) => p.text).join('')
    expect(text).toContain('2')
    expect(text).toContain('reviews waiting on you')
  })

  it('includes "1 failure overnight" with singular form', () => {
    const parts = buildBriefHeadlineParts(0, 0, 1)
    const text = parts.map((p) => p.text).join('')
    expect(text).toContain('1')
    expect(text).toContain(' failure overnight')
    expect(text).not.toContain(' failures overnight')
  })

  it('combines multiple non-zero counts in one sentence', () => {
    const parts = buildBriefHeadlineParts(2, 3, 1)
    const text = parts.map((p) => p.text).join('')
    expect(text).toContain('2')
    expect(text).toContain(' agents working')
    expect(text).toContain('3')
    expect(text).toContain('reviews waiting on you')
    expect(text).toContain('1')
    expect(text).toContain(' failure overnight')
  })
})

// ---------------------------------------------------------------------------
// deriveAttentionItems
// ---------------------------------------------------------------------------

describe('deriveAttentionItems', () => {
  const now = Date.now()

  it('includes a failed task regardless of age', () => {
    const task = makeTask({ status: 'failed', completed_at: new Date(now - 1000).toISOString() })
    const items = deriveAttentionItems(makePartition({ failed: [task] }), now)
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('failed')
    expect(items[0].action).toBe('Restart')
  })

  it('includes a review task older than 2 hours', () => {
    const staleMs = STALE_REVIEW_THRESHOLD_MS + 60_000
    const task = makeTask({
      status: 'review',
      promoted_to_review_at: new Date(now - staleMs).toISOString()
    })
    const items = deriveAttentionItems(makePartition({ pendingReview: [task] }), now)
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('review')
    expect(items[0].action).toBe('Review')
  })

  it('excludes a review task newer than 2 hours', () => {
    const freshMs = STALE_REVIEW_THRESHOLD_MS - 60_000
    const task = makeTask({
      status: 'review',
      promoted_to_review_at: new Date(now - freshMs).toISOString()
    })
    const items = deriveAttentionItems(makePartition({ pendingReview: [task] }), now)
    expect(items).toHaveLength(0)
  })

  it('sorts failed before blocked before review by severity', () => {
    const failedTask = makeTask({ status: 'failed', completed_at: new Date(now - 1000).toISOString() })
    const blockedTask = makeTask({ status: 'blocked', updated_at: new Date(now - 1000).toISOString() })
    const reviewTask = makeTask({
      status: 'review',
      promoted_to_review_at: new Date(now - STALE_REVIEW_THRESHOLD_MS - 1000).toISOString()
    })
    const items = deriveAttentionItems(
      makePartition({ failed: [failedTask], blocked: [blockedTask], pendingReview: [reviewTask] }),
      now
    )
    expect(items[0].kind).toBe('failed')
    expect(items[1].kind).toBe('blocked')
    expect(items[2].kind).toBe('review')
  })

  it('sorts same-severity items with older age first', () => {
    const olderTask = makeTask({
      status: 'failed',
      completed_at: new Date(now - 10_000).toISOString()
    })
    const newerTask = makeTask({
      status: 'failed',
      completed_at: new Date(now - 1_000).toISOString()
    })
    const items = deriveAttentionItems(makePartition({ failed: [newerTask, olderTask] }), now)
    expect(items[0].task.id).toBe(olderTask.id)
    expect(items[1].task.id).toBe(newerTask.id)
  })

  it('caps result at 5 items', () => {
    const tasks = Array.from({ length: 8 }, () =>
      makeTask({ status: 'failed', completed_at: new Date(now - 1000).toISOString() })
    )
    const items = deriveAttentionItems(makePartition({ failed: tasks }), now)
    expect(items).toHaveLength(5)
  })
})

// ---------------------------------------------------------------------------
// derivePerAgentStats
// ---------------------------------------------------------------------------

describe('derivePerAgentStats', () => {
  const now = Date.now()
  const recentIso = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const oldIso = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString()

  it('excludes agents started more than 7 days ago', () => {
    const old = makeAgent({ taskTitle: 'Old task', startedAt: oldIso })
    const recent = makeAgent({ taskTitle: 'Recent task', startedAt: recentIso })
    const rows = derivePerAgentStats([old, recent], new Map())
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Recent task')
  })

  it('computes correct successPct', () => {
    const finished = makeAgent({ taskTitle: 'Task A', startedAt: recentIso, finishedAt: recentIso, costUsd: 1 })
    const unfinished = makeAgent({ taskTitle: 'Task A', startedAt: recentIso, finishedAt: null, costUsd: 1 })
    const rows = derivePerAgentStats([finished, finished, unfinished], new Map())
    expect(rows[0].name).toBe('Task A')
    // 2 finished out of 3 = 66.67 → rounds to 67
    expect(rows[0].successPct).toBe(67)
  })

  it('sorts rows by run count descending', () => {
    const agents = [
      ...Array.from({ length: 3 }, () => makeAgent({ taskTitle: 'Few runs', startedAt: recentIso })),
      ...Array.from({ length: 5 }, () => makeAgent({ taskTitle: 'Many runs', startedAt: recentIso }))
    ]
    const rows = derivePerAgentStats(agents, new Map())
    expect(rows[0].name).toBe('Many runs')
    expect(rows[1].name).toBe('Few runs')
  })

  it('caps results at 6 rows', () => {
    const agents = Array.from({ length: 10 }, (_, i) =>
      makeAgent({ taskTitle: `Task ${i}`, startedAt: recentIso })
    )
    const rows = derivePerAgentStats(agents, new Map())
    expect(rows).toHaveLength(6)
  })
})

// ---------------------------------------------------------------------------
// derivePerRepoStats
// ---------------------------------------------------------------------------

describe('derivePerRepoStats', () => {
  const now = Date.now()
  const recentIso = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const oldIso = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString()

  it('excludes agents started more than 7 days ago', () => {
    const old = makeAgent({ repo: 'fleet', startedAt: oldIso })
    const recent = makeAgent({ repo: 'fleet', startedAt: recentIso })
    const rows = derivePerRepoStats([old, recent])
    expect(rows[0].runs).toBe(1)
  })

  it('counts PRs correctly', () => {
    const withPr = makeAgent({ repo: 'fleet', startedAt: recentIso, prUrl: 'https://github.com/pr/1', finishedAt: recentIso })
    const noPr = makeAgent({ repo: 'fleet', startedAt: recentIso, prUrl: null })
    const rows = derivePerRepoStats([withPr, noPr])
    expect(rows[0].repo).toBe('fleet')
    expect(rows[0].runs).toBe(2)
    expect(rows[0].prs).toBe(1)
  })

  it('caps results at 6 repos', () => {
    const agents = Array.from({ length: 10 }, (_, i) =>
      makeAgent({ repo: `repo-${i}`, startedAt: recentIso })
    )
    const rows = derivePerRepoStats(agents)
    expect(rows).toHaveLength(6)
  })

  it('aggregates multiple runs for the same repo', () => {
    const agents = Array.from({ length: 4 }, () =>
      makeAgent({ repo: 'fleet', startedAt: recentIso })
    )
    const rows = derivePerRepoStats(agents)
    expect(rows).toHaveLength(1)
    expect(rows[0].runs).toBe(4)
  })
})
