/**
 * Tests for runPreReviewAdvisors in pre-review-advisors.ts.
 *
 * Verifies:
 *   - Non-null advisory results are appended to task notes via appendAdvisoryNote
 *   - Null advisor results do not call appendAdvisoryNote
 *   - Errors thrown by individual advisors are caught, logged, and do not
 *     stall the pipeline — remaining advisors still run
 *   - All advisors returning null produces no appendAdvisoryNote calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('../verification-gate', () => ({
  appendAdvisoryNote: vi.fn()
}))

// ---------------------------------------------------------------------------
// Imports (after vi.mock declarations)
// ---------------------------------------------------------------------------

import { runPreReviewAdvisors, preReviewAdvisors, type PreReviewAdvisor } from '../pre-review-advisors'
import { appendAdvisoryNote } from '../verification-gate'
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
  let originalAdvisors: PreReviewAdvisor[]

  beforeEach(() => {
    vi.clearAllMocks()
    // Snapshot original advisors so we can restore them after each test
    originalAdvisors = [...preReviewAdvisors]
    // Clear the array so only our stub advisors run
    preReviewAdvisors.splice(0)
  })

  afterEach(() => {
    // Restore original advisors to prevent pollution
    preReviewAdvisors.splice(0, preReviewAdvisors.length, ...originalAdvisors)
  })

  it('calls appendAdvisoryNote once with the advisory string when an advisor returns a non-null warning', async () => {
    const warning = 'Test files not updated by this change'
    preReviewAdvisors.push({
      name: 'testAdvisor',
      advise: vi.fn().mockResolvedValue(warning)
    })

    const ctx = makeAdvisorContext()
    const repo = makeRepo()

    await runPreReviewAdvisors(ctx, repo)

    expect(appendAdvisoryNote).toHaveBeenCalledOnce()
    expect(appendAdvisoryNote).toHaveBeenCalledWith('task-1', warning, repo, ctx.logger)
  })

  it('does not call appendAdvisoryNote when the advisor returns null', async () => {
    preReviewAdvisors.push({
      name: 'quietAdvisor',
      advise: vi.fn().mockResolvedValue(null)
    })

    await runPreReviewAdvisors(makeAdvisorContext(), makeRepo())

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
    preReviewAdvisors.push(throwingAdvisor, secondAdvisor)

    const ctx = makeAdvisorContext()
    const repo = makeRepo()

    // Must not throw
    await expect(runPreReviewAdvisors(ctx, repo)).resolves.toBeUndefined()

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
    preReviewAdvisors.push(
      { name: 'a1', advise: vi.fn().mockResolvedValue(null) },
      { name: 'a2', advise: vi.fn().mockResolvedValue(null) }
    )

    await runPreReviewAdvisors(makeAdvisorContext(), makeRepo())

    expect(appendAdvisoryNote).not.toHaveBeenCalled()
  })
})
