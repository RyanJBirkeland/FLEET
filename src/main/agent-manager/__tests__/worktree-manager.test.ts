import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IAgentTaskRepository } from '../../data/sprint-task-repository'

vi.mock('../worktree', () => ({
  pruneStaleWorktrees: vi.fn()
}))

vi.mock('../../lib/async-utils', () => ({
  execFileAsync: vi.fn()
}))

vi.mock('../../env-utils', () => ({
  buildAgentEnv: vi.fn().mockReturnValue({})
}))

import { checkIsReviewTask, runPruneLoop, type WorktreeManagerDeps } from '../worktree-manager'
import { pruneStaleWorktrees } from '../worktree'
import { execFileAsync } from '../../lib/async-utils'
import {
  listWorktrees,
  addWorktree,
  removeWorktreeForce,
  pruneWorktrees,
  deleteBranch,
  forceDeleteBranchRef,
  cleanupWorktreeAndBranch
} from '../worktree-lifecycle'

function makeRepo(taskStatus?: string): IAgentTaskRepository {
  return {
    getTask: vi.fn().mockReturnValue(taskStatus ? { id: 'task-1', status: taskStatus } : null),
    updateTask: vi.fn().mockResolvedValue(null),
    claimTask: vi.fn().mockResolvedValue(null),
    getQueuedTasks: vi.fn().mockReturnValue([]),
    getTasksWithDependencies: vi.fn().mockReturnValue([]),
    releaseTask: vi.fn().mockResolvedValue(null),
    listActiveAgentRuns: vi.fn().mockReturnValue([])
  } as unknown as IAgentTaskRepository
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}

describe('checkIsReviewTask', () => {
  it('returns true when task status is review', () => {
    const repo = makeRepo('review')
    expect(checkIsReviewTask('task-1', repo)).toBe(true)
  })

  it('returns false when task status is active', () => {
    const repo = makeRepo('active')
    expect(checkIsReviewTask('task-1', repo)).toBe(false)
  })

  it('returns false when task is not found', () => {
    const repo = makeRepo()
    expect(checkIsReviewTask('task-1', repo)).toBe(false)
  })

  it('returns false when getTask throws', () => {
    const repo = makeRepo()
    vi.mocked(repo.getTask).mockImplementation(() => {
      throw new Error('DB error')
    })
    expect(checkIsReviewTask('task-1', repo)).toBe(false)
  })
})

describe('runPruneLoop', () => {
  let deps: WorktreeManagerDeps

  beforeEach(() => {
    vi.clearAllMocks()
    deps = {
      worktreeBase: '/tmp/worktrees',
      repo: makeRepo(),
      logger: makeLogger(),
      isActiveAgent: vi.fn().mockReturnValue(false),
      isReviewTask: vi.fn().mockReturnValue(false)
    }
  })

  it('calls pruneStaleWorktrees with the correct arguments', async () => {
    vi.mocked(pruneStaleWorktrees).mockResolvedValue(undefined)
    await runPruneLoop(deps)
    expect(pruneStaleWorktrees).toHaveBeenCalledWith(
      deps.worktreeBase,
      deps.isActiveAgent,
      deps.logger,
      deps.isReviewTask
    )
  })

  it('propagates errors from pruneStaleWorktrees (no internal catch)', async () => {
    const err = new Error('prune failed')
    vi.mocked(pruneStaleWorktrees).mockRejectedValue(err)
    await expect(runPruneLoop(deps)).rejects.toThrow('prune failed')
  })
})

// ---------------------------------------------------------------------------
// worktree-lifecycle timeout propagation
// ---------------------------------------------------------------------------

describe('worktree-lifecycle git timeout propagation', () => {
  const env = {}
  const timeoutError = Object.assign(new Error('Command timed out'), { code: 'ETIMEDOUT', killed: true })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listWorktrees propagates timeout error from execFileAsync', async () => {
    vi.mocked(execFileAsync).mockRejectedValue(timeoutError)
    await expect(listWorktrees('/repo', env)).rejects.toThrow('Command timed out')
  })

  it('addWorktree propagates timeout error from execFileAsync', async () => {
    vi.mocked(execFileAsync).mockRejectedValue(timeoutError)
    await expect(addWorktree('/repo', 'agent/task-1', '/wt', env)).rejects.toThrow('Command timed out')
  })

  it('removeWorktreeForce propagates timeout error from execFileAsync', async () => {
    vi.mocked(execFileAsync).mockRejectedValue(timeoutError)
    await expect(removeWorktreeForce('/repo', '/wt', env)).rejects.toThrow('Command timed out')
  })

  it('pruneWorktrees propagates timeout error from execFileAsync', async () => {
    vi.mocked(execFileAsync).mockRejectedValue(timeoutError)
    await expect(pruneWorktrees('/repo', env)).rejects.toThrow('Command timed out')
  })

  it('deleteBranch propagates timeout error from execFileAsync', async () => {
    vi.mocked(execFileAsync).mockRejectedValue(timeoutError)
    await expect(deleteBranch('/repo', 'agent/task-1', env)).rejects.toThrow('Command timed out')
  })

  it('forceDeleteBranchRef propagates timeout error from execFileAsync', async () => {
    vi.mocked(execFileAsync).mockRejectedValue(timeoutError)
    await expect(forceDeleteBranchRef('/repo', 'agent/task-1', env)).rejects.toThrow('Command timed out')
  })

  it('cleanupWorktreeAndBranch swallows timeout errors on both worktree remove and branch delete (best-effort cleanup)', async () => {
    vi.mocked(execFileAsync).mockRejectedValue(timeoutError)
    const logger = makeLogger()
    // Should not throw — cleanup is best-effort
    await expect(cleanupWorktreeAndBranch('/wt', 'agent/task-1', '/repo', logger)).resolves.toBeUndefined()
    // Both failures should produce warn logs
    expect(logger.warn).toHaveBeenCalledTimes(2)
  })
})
