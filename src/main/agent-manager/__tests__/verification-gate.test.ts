/**
 * Tests for the pre-review verification gates in verification-gate.ts.
 *
 * capOutput — pure text truncation helper.
 * toVerificationRecord — converts a CommandResult to a VerificationRecord.
 *
 * verifyBranchTipOrFail — validates branch tip references this task before
 *   allowing the review transition. Routes mismatches to 'failed' status.
 *
 * verifyWorktreeOrFail — runs typecheck + tests in the worktree, persists
 *   results regardless of outcome, then requeues or fails the task on
 *   verification failure; never calls onTaskTerminal when the DB write fails.
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

import { capOutput, toVerificationRecord, verifyBranchTipOrFail, verifyWorktreeOrFail } from '../verification-gate'
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
// capOutput
// ---------------------------------------------------------------------------

describe('capOutput', () => {
  it('returns text unchanged when under the cap', () => {
    expect(capOutput('hello', 100)).toEqual({ text: 'hello', truncated: false })
  })

  it('truncates to exactly cap chars and sets truncated true', () => {
    const result = capOutput('abcde', 3)
    expect(result.text).toBe('abc')
    expect(result.truncated).toBe(true)
  })

  it('handles empty string', () => {
    expect(capOutput('', 100)).toEqual({ text: '', truncated: false })
  })

  it('returns text unchanged when length equals the cap exactly', () => {
    expect(capOutput('abc', 3)).toEqual({ text: 'abc', truncated: false })
  })
})

// ---------------------------------------------------------------------------
// toVerificationRecord
// ---------------------------------------------------------------------------

describe('toVerificationRecord', () => {
  it('sets exitCode 0 on ok result', () => {
    const rec = toVerificationRecord({ ok: true, stdout: 'out', stderr: '', durationMs: 100 })
    expect(rec.exitCode).toBe(0)
    expect(rec.stdout).toBe('out')
    expect(rec.truncated).toBe(false)
  })

  it('sets exitCode 1 on failed result', () => {
    const rec = toVerificationRecord({ ok: false, stdout: '', stderr: 'err', durationMs: 50 })
    expect(rec.exitCode).toBe(1)
    expect(rec.stderr).toBe('err')
  })

  it('sets truncated true when stdout exceeds cap', () => {
    const longStdout = 'x'.repeat(10_001)
    const rec = toVerificationRecord({ ok: true, stdout: longStdout, stderr: '', durationMs: 0 })
    expect(rec.truncated).toBe(true)
    expect(rec.stdout.length).toBe(10_000)
  })

  it('sets truncated true when stderr exceeds cap', () => {
    const longStderr = 'e'.repeat(10_001)
    const rec = toVerificationRecord({ ok: false, stdout: '', stderr: longStderr, durationMs: 0 })
    expect(rec.truncated).toBe(true)
    expect(rec.stderr.length).toBe(10_000)
  })

  it('includes durationMs and a timestamp ISO string', () => {
    const rec = toVerificationRecord({ ok: true, stdout: '', stderr: '', durationMs: 42 })
    expect(rec.durationMs).toBe(42)
    expect(rec.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ---------------------------------------------------------------------------
// verifyBranchTipOrFail
// ---------------------------------------------------------------------------

describe('verifyBranchTipOrFail', () => {
  let logger: ReturnType<typeof makeLogger>
  let taskStateService: ReturnType<typeof makeTaskStateService>

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    taskStateService = makeTaskStateService()
  })

  it('returns true and emits a warn when repoPath is undefined, without calling assertBranchTipMatches', async () => {
    const repo = makeRepo()

    const result = await verifyBranchTipOrFail(
      'task-1', 'agent/task-1', undefined, repo, logger, taskStateService
    )

    expect(result).toBe(true)
    expect(assertBranchTipMatches).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      '[verification-gate] branch-tip check skipped — repoPath absent'
    )
  })

  it('returns false when repo.getTask returns null, without calling assertBranchTipMatches', async () => {
    const repo = makeRepo(null)

    const result = await verifyBranchTipOrFail(
      'task-1', 'agent/task-1', '/repo', repo, logger, taskStateService
    )

    expect(result).toBe(false)
    expect(assertBranchTipMatches).not.toHaveBeenCalled()
  })

  it('returns true when assertBranchTipMatches resolves successfully', async () => {
    vi.mocked(assertBranchTipMatches).mockResolvedValue(undefined)
    const repo = makeRepo()

    const result = await verifyBranchTipOrFail(
      'task-1', 'agent/task-1', '/repo', repo, logger, taskStateService
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
      'task-1', 'agent/task-1', '/repo', repo, logger, taskStateService
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
      'task-1', 'agent/task-1', '/repo', repo, logger, taskStateService
    )

    expect(result).toBe(true)
    expect(logger.warn).toHaveBeenCalled()
    expect(taskStateService.transition).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// verifyWorktreeOrFail
// ---------------------------------------------------------------------------

const okOutput = { ok: true as const, stdout: '', stderr: '', durationMs: 0 }

describe('verifyWorktreeOrFail', () => {
  let logger: ReturnType<typeof makeLogger>
  let repo: IAgentTaskRepository
  let onTaskTerminal: ReturnType<typeof vi.fn>
  let taskStateService: ReturnType<typeof makeTaskStateService>

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    repo = makeRepo()
    onTaskTerminal = vi.fn().mockResolvedValue(undefined)
    taskStateService = makeTaskStateService()
  })

  it('returns true and never calls onTaskTerminal when both steps pass', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      typecheck: okOutput,
      tests: okOutput
    })

    const result = await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal,
      taskStateService
    })

    expect(result).toBe(true)
    expect(onTaskTerminal).not.toHaveBeenCalled()
  })

  it('returns true when both steps are null (no scripts found)', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      typecheck: null,
      tests: null
    })

    const result = await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal,
      taskStateService
    })

    expect(result).toBe(true)
    expect(onTaskTerminal).not.toHaveBeenCalled()
  })

  it('persists verification_results to the repo regardless of outcome', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      typecheck: okOutput,
      tests: okOutput
    })

    await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal,
      taskStateService
    })

    expect(repo.updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ verification_results: expect.objectContaining({ typecheck: expect.any(Object), tests: expect.any(Object) }) })
    )
  })

  it('persists verification_results even when typecheck fails', async () => {
    const failOutput = { ok: false as const, stdout: '', stderr: 'tsc error', durationMs: 0 }
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      typecheck: failOutput,
      tests: null
    })
    vi.mocked(resolveFailure).mockResolvedValue({ writeFailed: true, isTerminal: false })

    await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal,
      taskStateService
    })

    expect(repo.updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ verification_results: expect.any(Object) })
    )
  })

  it('returns false and never calls onTaskTerminal when resolveFailure returns writeFailed: true', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      typecheck: { ok: false, stdout: '', stderr: 'tsc error', durationMs: 0 },
      tests: null
    })
    vi.mocked(resolveFailure).mockResolvedValue({ writeFailed: true, isTerminal: false })

    const result = await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal,
      taskStateService
    })

    expect(result).toBe(false)
    expect(onTaskTerminal).not.toHaveBeenCalled()
  })

  it('calls onTaskTerminal with queued when resolveFailure returns isTerminal: false', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      typecheck: { ok: false, stdout: '', stderr: 'tsc error', durationMs: 0 },
      tests: null
    })
    vi.mocked(resolveFailure).mockResolvedValue({ writeFailed: false, isTerminal: false })

    const result = await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal,
      taskStateService
    })

    expect(result).toBe(false)
    expect(onTaskTerminal).toHaveBeenCalledOnce()
    expect(onTaskTerminal).toHaveBeenCalledWith('task-1', 'queued')
  })

  it('calls onTaskTerminal with failed when resolveFailure returns isTerminal: true', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      typecheck: { ok: false, stdout: '', stderr: 'tsc error', durationMs: 0 },
      tests: null
    })
    vi.mocked(resolveFailure).mockResolvedValue({ writeFailed: false, isTerminal: true })

    const result = await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal,
      taskStateService
    })

    expect(result).toBe(false)
    expect(onTaskTerminal).toHaveBeenCalledOnce()
    expect(onTaskTerminal).toHaveBeenCalledWith('task-1', 'failed')
  })

  it('routes test failure to resolveFailure with test_failure kind', async () => {
    vi.mocked(verifyWorktreeBuildsAndTests).mockResolvedValue({
      typecheck: okOutput,
      tests: { ok: false, stdout: '', stderr: '3 tests failed', durationMs: 0 }
    })
    vi.mocked(resolveFailure).mockResolvedValue({ writeFailed: false, isTerminal: false })

    await verifyWorktreeOrFail({
      taskId: 'task-1',
      worktreePath: '/worktree',
      retryCount: 0,
      repo,
      logger,
      onTaskTerminal,
      taskStateService
    })

    expect(logger.event).toHaveBeenCalledWith(
      'completion.decision',
      expect.objectContaining({ reason: 'test_failure' })
    )
  })
})
