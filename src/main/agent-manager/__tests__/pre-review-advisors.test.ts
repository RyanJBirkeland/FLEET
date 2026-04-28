/**
 * Tests for runPreReviewAdvisors in pre-review-advisors.ts.
 *
 * Verifies:
 *   - Non-null advisory results are appended to task notes via appendAdvisoryNote
 *   - Null advisor results do not call appendAdvisoryNote
 *   - Errors thrown by individual advisors are caught, logged, and do not
 *     stall the pipeline — remaining advisors still run
 *   - All advisors returning null produces no appendAdvisoryNote calls
 *   - unverifiedFactsAdvisor logs a specific message (not a generic one) for
 *     single-commit branches where HEAD~1 is invalid
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('../verification-gate', () => ({
  appendAdvisoryNote: vi.fn()
}))

vi.mock('../../lib/async-utils', () => ({
  execFileAsync: vi.fn()
}))

vi.mock('../env-utils', () => ({
  buildAgentEnv: vi.fn().mockReturnValue({})
}))

vi.mock('../test-touch-check', () => ({
  listChangedFiles: vi.fn().mockResolvedValue([]),
  detectUntouchedTests: vi.fn().mockReturnValue([]),
  formatAdvisory: vi.fn().mockReturnValue('')
}))

vi.mock('../unverified-facts-scanner', () => ({
  scanForUnverifiedFacts: vi.fn().mockReturnValue([])
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('{}')
}))

// ---------------------------------------------------------------------------
// Imports (after vi.mock declarations)
// ---------------------------------------------------------------------------

import { runPreReviewAdvisors, DEFAULT_PRE_REVIEW_ADVISORS, type PreReviewAdvisor } from '../pre-review-advisors'
import { appendAdvisoryNote } from '../verification-gate'
import { execFileAsync } from '../../lib/async-utils'
import { makeLogger } from './test-helpers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdvisorContext(taskId = 'task-1') {
  return {
    taskId,
    branch: 'agent/task-1',
    worktreePath: '/worktree/task-1',
    repoPath: undefined,
    logger: makeLogger()
  }
}

function makeRepo() {
  return {
    getTask: vi.fn().mockReturnValue(null),
    updateTask: vi.fn().mockResolvedValue(null)
  } as unknown as import('../../data/sprint-task-repository').IAgentTaskRepository
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runPreReviewAdvisors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls appendAdvisoryNote once with the advisory string when an advisor returns a non-null warning', async () => {
    const warning = 'Test files not updated by this change'
    const advisors: PreReviewAdvisor[] = [
      { name: 'testAdvisor', advise: vi.fn().mockResolvedValue(warning) }
    ]

    const ctx = makeAdvisorContext()
    const repo = makeRepo()

    await runPreReviewAdvisors(ctx, repo, advisors)

    expect(appendAdvisoryNote).toHaveBeenCalledOnce()
    expect(appendAdvisoryNote).toHaveBeenCalledWith('task-1', warning, repo, ctx.logger)
  })

  it('does not call appendAdvisoryNote when the advisor returns null', async () => {
    const advisors: PreReviewAdvisor[] = [
      { name: 'quietAdvisor', advise: vi.fn().mockResolvedValue(null) }
    ]

    await runPreReviewAdvisors(makeAdvisorContext(), makeRepo(), advisors)

    expect(appendAdvisoryNote).not.toHaveBeenCalled()
  })

  it('logs a warning and continues running subsequent advisors when the first advisor throws', async () => {
    const secondAdvisoryResult = 'Second advisor found something'

    const throwingAdvisor: PreReviewAdvisor = {
      name: 'throwingAdvisor',
      advise: vi.fn().mockRejectedValue(new Error('boom'))
    }
    const secondAdvisor: PreReviewAdvisor = {
      name: 'secondAdvisor',
      advise: vi.fn().mockResolvedValue(secondAdvisoryResult)
    }

    const ctx = makeAdvisorContext()
    const repo = makeRepo()

    // Must not throw
    await expect(runPreReviewAdvisors(ctx, repo, [throwingAdvisor, secondAdvisor])).resolves.toBeUndefined()

    // First advisor error was logged with the advisor name
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('throwingAdvisor')
    )

    // Second advisor still ran and produced an appendAdvisoryNote call
    expect(secondAdvisor.advise).toHaveBeenCalledTimes(1)
    expect(appendAdvisoryNote).toHaveBeenCalledOnce()
    expect(appendAdvisoryNote).toHaveBeenCalledWith('task-1', secondAdvisoryResult, repo, ctx.logger)
  })

  it('never calls appendAdvisoryNote when all advisors return null', async () => {
    const advisors: PreReviewAdvisor[] = [
      { name: 'a1', advise: vi.fn().mockResolvedValue(null) },
      { name: 'a2', advise: vi.fn().mockResolvedValue(null) }
    ]

    await runPreReviewAdvisors(makeAdvisorContext(), makeRepo(), advisors)

    expect(appendAdvisoryNote).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// unverifiedFactsAdvisor — single-commit branch handling
// ---------------------------------------------------------------------------

describe('unverifiedFactsAdvisor single-commit branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs the first-commit message (not a generic skip) and returns null when git diff fails with unknown revision', async () => {
    // Simulate git refusing to diff HEAD~1 on a single-commit branch
    vi.mocked(execFileAsync).mockRejectedValue(
      new Error("unknown revision or path not in the working tree: HEAD~1 'HEAD'")
    )

    const ctx = makeAdvisorContext()
    const repo = makeRepo()

    // runPreReviewAdvisors swallows advisor errors — check the log directly
    await runPreReviewAdvisors(ctx, repo, DEFAULT_PRE_REVIEW_ADVISORS)

    // The specific first-commit message must appear on the logger
    expect(ctx.logger.info).toHaveBeenCalledWith(
      '[pre-review-advisors] first-commit branch — unverified-facts advisory skipped'
    )

    // The generic skip warning must NOT appear
    expect(ctx.logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('unverifiedFacts')
    )
  })

  it('propagates non-single-commit errors as a generic advisor skip warning', async () => {
    vi.mocked(execFileAsync).mockRejectedValue(new Error('git: command not found'))

    const ctx = makeAdvisorContext()
    await runPreReviewAdvisors(ctx, makeRepo(), DEFAULT_PRE_REVIEW_ADVISORS)

    // A non-single-commit error should NOT emit the first-commit message
    expect(ctx.logger.info).not.toHaveBeenCalledWith(
      '[pre-review-advisors] first-commit branch — unverified-facts advisory skipped'
    )
    // The orchestrator's generic warn should fire instead
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unverifiedFacts')
    )
  })
})
