import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../diff-snapshot', () => ({ captureDiffSnapshot: vi.fn() }))
vi.mock('../../lib/async-utils', () => ({ execFileAsync: vi.fn() }))
vi.mock('../../env-utils', () => ({ buildAgentEnv: vi.fn(() => ({})) }))

import { captureDiffSnapshot } from '../diff-snapshot'
import { execFileAsync } from '../../lib/async-utils'
import { transitionToReview } from '../review-transition'

function makeRepo() {
  return {
    getTask: vi.fn().mockReturnValue({ started_at: new Date(Date.now() - 1000).toISOString() }),
    updateTask: vi.fn()
  }
}

function makeTaskStateService() {
  return { transition: vi.fn().mockResolvedValue(undefined) }
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), event: vi.fn() }
}

function makeOpts(
  overrides: Partial<Parameters<typeof transitionToReview>[0]> = {}
): Parameters<typeof transitionToReview>[0] {
  return {
    taskId: 't-1',
    worktreePath: '/tmp/worktree',
    rebaseNote: undefined,
    rebaseBaseSha: undefined,
    rebaseSucceeded: false,
    repo: makeRepo() as never,
    logger: makeLogger() as never,
    taskStateService: makeTaskStateService() as never,
    ...overrides
  }
}

beforeEach(() => {
  vi.mocked(execFileAsync).mockResolvedValue({ stdout: '3\n', stderr: '' })
  vi.mocked(captureDiffSnapshot).mockResolvedValue(null)
})

describe('transitionToReview — happy path', () => {
  it('calls taskStateService.transition with review status and worktree path', async () => {
    const taskStateService = makeTaskStateService()
    const opts = makeOpts({ taskStateService: taskStateService as never })

    await transitionToReview(opts)

    expect(taskStateService.transition).toHaveBeenCalledOnce()
    expect(taskStateService.transition).toHaveBeenCalledWith(
      't-1',
      'review',
      expect.objectContaining({ fields: expect.objectContaining({ worktree_path: '/tmp/worktree' }) })
    )
  })

  it('calls taskStateService.transition with null claimed_by', async () => {
    const taskStateService = makeTaskStateService()
    await transitionToReview(makeOpts({ taskStateService: taskStateService as never }))
    const [, , opts] = taskStateService.transition.mock.calls[0]
    expect(opts.fields.claimed_by).toBeNull()
  })
})

describe('transitionToReview — captureDiffSnapshot throws', () => {
  it('logs a warning but still calls taskStateService.transition', async () => {
    vi.mocked(captureDiffSnapshot).mockRejectedValue(new Error('git diff failed'))
    const logger = makeLogger()
    const taskStateService = makeTaskStateService()
    const opts = makeOpts({ logger: logger as never, taskStateService: taskStateService as never })

    // Should not reject — error is caught internally
    await expect(transitionToReview(opts)).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Diff snapshot capture failed'))
    expect(taskStateService.transition).toHaveBeenCalledOnce()
  })
})

describe('transitionToReview — taskStateService.transition throws', () => {
  it('logs an error and resolves without re-throwing (task silently remains claimed)', async () => {
    const logger = makeLogger()
    const taskStateService = makeTaskStateService()
    taskStateService.transition.mockRejectedValue(new Error('DB busy'))
    const opts = makeOpts({ logger: logger as never, taskStateService: taskStateService as never })

    // The function catches the error and resolves — this is the silent-failure
    // behavior identified in the audit. The test documents it; fixing requires
    // re-throwing or an explicit notification mechanism.
    await expect(transitionToReview(opts)).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to transition task t-1 to review status')
    )
  })
})
