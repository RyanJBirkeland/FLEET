/**
 * Tests for the pre-review verification gates in verification-gate.ts.
 *
 * verifyBranchTipOrFail — validates branch tip references this task before
 *   allowing the review transition. Routes mismatches to 'failed' status.
 *
 * verifyWorktreeOrFail — runs typecheck + tests in the worktree. Requeues or
 *   fails the task on verification failure; never calls onTaskTerminal when
 *   the DB write fails.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('../resolve-success-phases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../resolve-success-phases')>()
  return {
    ...actual,
    assertBranchTipMatches: vi.fn()
  }
})

vi.mock('../verify-worktree', () => ({
  verifyWorktreeBuildsAndTests: vi.fn()
}))

vi.mock('../resolve-failure-phases', () => ({
  resolveFailure: vi.fn()
}))

vi.mock('../revision-feedback-builder', () => ({
  buildVerificationRevisionFeedback: vi.fn().mockReturnValue({ kind: 'compilation', feedback: 'tsc error' })
}))

// ---------------------------------------------------------------------------
// Imports (after vi.mock declarations)
// ---------------------------------------------------------------------------

import { verifyBranchTipOrFail, verifyWorktreeOrFail } from '../verification-gate'
import { assertBranchTipMatches, BranchTipMismatchError } from '../resolve-success-phases'
import { verifyWorktreeBuildsAndTests } from '../verify-worktree'
import { resolveFailure } from '../resolve-failure-phases'
import type { IAgentTaskRepository } from '../../data/sprint-task-repository'
import type { TaskStateService } from '../../services/task-state-service'
import { makeLogger } from './test-helpers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(task: Record<string, unknown> | null = { id: 'task-1', title: 'Test task', agent_run_id: null }): IAgentTaskRepository {
  return {
    getTask: vi.fn().mockReturnValue(task),
    updateTask: vi.fn().mockResolvedValue(null),
    getQueuedTasks: vi.fn().mockReturnValue([]),
    getTasksWithDependencies: vi.fn().mockReturnValue([]),
    getOrphanedTasks: vi.fn().mockReturnValue([]),
    clearStaleClaimedBy: vi.fn().mockReturnValue(0),
    getActiveTaskCount: vi.fn().mockReturnValue(0),
    claimTask: vi.fn().mockResolvedValue(null),
    getGroup: vi.fn().mockReturnValue(null),
    getGroupTasks: vi.fn().mockReturnValue([]),
    getGroupsWithDependencies: vi.fn().mockReturnValue([]),
    getQueueStats: vi.fn().mockReturnValue({ queued: 0, active: 0 })
  } as unknown as IAgentTaskRepository
}

function makeTaskStateService(): TaskStateService {
  return {
    transition: vi.fn().mockResolvedValue({ transitioned: true })
  } as unknown as TaskStateService
}

// ---------------------------------------------------------------------------
// verifyBranchTipOrFail
// ---------------------------------------------------------------------------

describe('verifyBranchTipOrFail', () => {
  let logger: ReturnType<typeof makeLogger>
  let taskStateService: ReturnType<typeof makeTaskStateService>
  let onTaskTerminal: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    taskStateService = makeTaskStateService()
    onTaskTerminal = vi.fn().mockResolvedValue(undefined)
  })

  it('returns true immediately when repoPath is undefined, without calling assertBranchTipMatches', async () => {
    const repo = makeRepo()

    const result = await verifyBranchTipOrFail(
      'task-1', 'agent/task-1', undefined, repo, logger, onTaskTerminal, taskStateService
    )

    expect(result).toBe(true)
    expect(assertBranchTipMatches).not.toHaveBeenCalled()
  })

  it('returns false when repo.getTask returns null, without calling assertBranchTipMatches', async () => {
    const repo = makeRepo(null)

    const result = await verifyBranchTipOrFail(
      'task-1', 'agent/task-1', '/repo', repo, logger, onTaskTerminal, taskStateService
    )

    expect(result).toBe(false)
    expect(assertBranchTipMatches).not.toHaveBeenCalled()
  })

  it('returns true when assertBranchTipMatches resolves successfully', async () => {
    vi.mocked(assertBranchTipMatches).mockResolvedValue(undefined)
    const repo = makeRepo()

    const result = await verifyBranchTipOrFail(
      'task-1', 'agent/task-1', '/repo', repo, logger, onTaskTerminal, taskStateService
    )

    expect(result).toBe(true)
    expect(assertBranchTipMatches).toHaveBeenCalledTimes(1)
  })

  it('transitions task to failed and returns false when assertBranchTipMatches throws BranchTipMismatchError', async () => {
    const mismatch = new BranchTipMismatchError(
      ['task-1', 't-1'],
      'unrelated commit subject'
    )
    vi.mocked(assertBranchTipMatches).mockRejectedValue(mismatch)
    const repo = makeRepo()

    const result = await verifyBranchTipOrFail(
      'task-1', 'agent/task-1', '/repo', repo, logger, onTaskTerminal, taskStateService
    )

    expect(result).toBe(false)
    expect(taskStateService.transition).toHaveBeenCalledWith(
      'task-1',
      'failed',
      expect.objectContaining({ fields: expect.objectContaining({ failure_reason: 'tip-mismatch' }) })
    )
  })

  it('logs a warning and returns true when assertBranchTipMatches throws a non-mismatch error', async () => {
    vi.mocked(assertBranchTipMatches).mockRejectedValue(new Error('git not found'))
    const repo = makeRepo()

    const result = await verifyBranchTipOrFail(
      'task-1', 'agent/task-1', '/repo', repo, logger, onTaskTerminal, taskStateService
    )

    expect(result).toBe(true)
    expect(logger.warn).toHaveBeenCalled()
    expect(taskStateService.transition).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// verifyWorktreeOrFail
// ---------------------------------------------------------------------------

describe('verifyWorktreeOrFail', () => {
  let logger: ReturnType<typeof makeLogger>
  let repo: IAgentTaskRepository
  let onTaskTerminal: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    repo = makeRepo()
    onTaskTerminal = vi.fn().mockResolvedValue(undefined)
  })

  it('returns true and never calls onTaskTerminal when verification succeeds', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({ ok: true })

    const result = await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal
    })

    expect(result).toBe(true)
    expect(onTaskTerminal).not.toHaveBeenCalled()
  })

  it('returns false and never calls onTaskTerminal when resolveFailure returns writeFailed: true', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      ok: false,
      failure: { kind: 'compilation', stderr: 'tsc error' }
    })
    vi.mocked(resolveFailure).mockResolvedValue({ writeFailed: true, isTerminal: false })

    const result = await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal
    })

    expect(result).toBe(false)
    expect(onTaskTerminal).not.toHaveBeenCalled()
  })

  it('calls onTaskTerminal with queued when resolveFailure returns isTerminal: false', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      ok: false,
      failure: { kind: 'compilation', stderr: 'tsc error' }
    })
    vi.mocked(resolveFailure).mockResolvedValue({ writeFailed: false, isTerminal: false })

    const result = await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal
    })

    expect(result).toBe(false)
    expect(onTaskTerminal).toHaveBeenCalledOnce()
    expect(onTaskTerminal).toHaveBeenCalledWith('task-1', 'queued')
  })

  it('calls onTaskTerminal with failed when resolveFailure returns isTerminal: true', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      ok: false,
      failure: { kind: 'compilation', stderr: 'tsc error' }
    })
    vi.mocked(resolveFailure).mockResolvedValue({ writeFailed: false, isTerminal: true })

    const result = await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal
    })

    expect(result).toBe(false)
    expect(onTaskTerminal).toHaveBeenCalledOnce()
    expect(onTaskTerminal).toHaveBeenCalledWith('task-1', 'failed')
  })
})
