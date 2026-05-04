import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock calls are hoisted — they run before imports and intercept all
// dependency modules loaded by the service under test.

vi.mock('../lib/async-utils', () => ({
  execFileAsync: vi.fn()
}))

vi.mock('../lib/default-branch', () => ({
  resolveDefaultBranch: vi.fn().mockResolvedValue('main')
}))

vi.mock('../env-utils', () => ({
  buildAgentEnv: vi.fn().mockReturnValue({ PATH: '/usr/bin' })
}))

vi.mock('../logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('./review-action-policy', () => ({
  classifyReviewAction: vi.fn().mockReturnValue({
    gitOps: [],
    taskPatch: null,
    terminalStatus: null
  })
}))

vi.mock('../services/review-action-executor', () => ({
  executeReviewAction: vi.fn().mockResolvedValue({ branch: 'agent/task-1', baseSha: undefined })
}))

vi.mock('../services/review-pr-service', () => ({
  createPullRequest: vi.fn().mockResolvedValue({
    success: true,
    prUrl: 'https://github.com/org/repo/pull/42',
    prNumber: 42
  })
}))

vi.mock('../services/review-merge-service', () => ({
  cleanupWorktree: vi.fn().mockResolvedValue(undefined),
  parseNumstat: vi.fn()
}))

vi.mock('../paths', () => ({
  getRepoConfig: vi.fn().mockReturnValue({
    name: 'fleet',
    localPath: '/repos/fleet',
    githubOwner: 'org',
    githubRepo: 'fleet'
  })
}))

import { createReviewOrchestrationService } from '../services/review-orchestration-service'
import { executeReviewAction } from '../services/review-action-executor'
import { createPullRequest } from '../services/review-pr-service'
import { execFileAsync } from '../lib/async-utils'
import type { ISprintTaskRepository } from '../data/sprint-task-repository'
import type { SprintTask } from '../../shared/types/task-types'

// ============================================================================
// Helpers
// ============================================================================

function makeTask(overrides: Partial<SprintTask> = {}): SprintTask {
  return {
    id: 'task-abc123',
    title: 'Test task',
    status: 'review',
    repo: 'fleet',
    spec: '## Goal\nDo the thing.',
    spec_type: 'spec',
    notes: null,
    priority: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    completed_at: null,
    failure_reason: null,
    retry_count: 0,
    claimed_by: null,
    agent_run_id: 'run-1',
    worktree_path: '/tmp/worktrees/task-abc123',
    pr_url: null,
    pr_number: null,
    pr_status: null,
    rebase_base_sha: null,
    rebased_at: null,
    branch: 'agent/task-abc123',
    needs_review: true,
    playground_enabled: false,
    max_runtime_ms: null,
    template_name: null,
    tags: null,
    epic_id: null,
    depends_on: null,
    revision_feedback: null,
    ...overrides
  } as unknown as SprintTask
}

function makeRepo(task: SprintTask | null = makeTask()): Pick<ISprintTaskRepository, 'getTask' | 'updateTask'> & ISprintTaskRepository {
  return {
    getTask: vi.fn().mockReturnValue(task),
    updateTask: vi.fn().mockResolvedValue(task),
    claimTask: vi.fn(),
    getQueuedTasks: vi.fn().mockReturnValue([]),
    getTasksWithDependencies: vi.fn().mockReturnValue([]),
    listTasks: vi.fn().mockReturnValue([]),
    getGroup: vi.fn(),
    getGroupTasks: vi.fn().mockReturnValue([]),
    createTask: vi.fn(),
    forceUpdateTask: vi.fn(),
    deleteTask: vi.fn()
  } as unknown as ISprintTaskRepository
}

const mockGetTask = vi.fn()
const mockUpdateTask = vi.fn()
const mockNotifySprintMutation = vi.fn()
const mockOnStatusTerminal = vi.fn()

function makeService(task: SprintTask | null = makeTask()) {
  const repo = makeRepo(task)
  mockGetTask.mockReturnValue(task)
  mockUpdateTask.mockResolvedValue(task)
  mockNotifySprintMutation.mockReset()
  mockOnStatusTerminal.mockReset()

  const service = createReviewOrchestrationService(repo, {
    getTask: mockGetTask,
    updateTask: mockUpdateTask,
    notifySprintMutation: mockNotifySprintMutation
  })

  return { service, repo }
}

const TEST_ENV: NodeJS.ProcessEnv = { PATH: '/usr/bin' }

// ============================================================================
// mergeLocally
// ============================================================================

describe('mergeLocally', () => {
  beforeEach(() => {
    vi.mocked(executeReviewAction).mockResolvedValue({ branch: 'agent/task-abc123', baseSha: undefined })
  })

  it('returns success when the git op completes', async () => {
    const { service } = makeService()

    const result = await service.mergeLocally({
      taskId: 'task-abc123',
      strategy: 'squash',
      env: TEST_ENV,
      onStatusTerminal: mockOnStatusTerminal
    })

    expect(result.success).toBe(true)
    expect(executeReviewAction).toHaveBeenCalled()
  })

  it('returns failure with error message when the git op throws', async () => {
    vi.mocked(executeReviewAction).mockRejectedValueOnce(new Error('Merge conflict detected'))
    const { service } = makeService()

    const result = await service.mergeLocally({
      taskId: 'task-abc123',
      strategy: 'squash',
      env: TEST_ENV,
      onStatusTerminal: mockOnStatusTerminal
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Merge conflict detected')
  })

  it('surfaces conflict file list when error carries conflicts property', async () => {
    const conflictError = Object.assign(new Error('Conflicts'), {
      conflicts: ['src/foo.ts', 'src/bar.ts']
    })
    vi.mocked(executeReviewAction).mockRejectedValueOnce(conflictError)
    const { service } = makeService()

    const result = await service.mergeLocally({
      taskId: 'task-abc123',
      strategy: 'merge',
      env: TEST_ENV,
      onStatusTerminal: mockOnStatusTerminal
    })

    expect(result.success).toBe(false)
    expect(result.conflicts).toEqual(['src/foo.ts', 'src/bar.ts'])
  })

  it('returns failure when task is not found', async () => {
    const { service } = makeService(null)

    const result = await service.mergeLocally({
      taskId: 'task-abc123',
      strategy: 'merge',
      env: TEST_ENV,
      onStatusTerminal: mockOnStatusTerminal
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})

// ============================================================================
// requestRevision
// ============================================================================

describe('requestRevision', () => {
  beforeEach(() => {
    vi.mocked(executeReviewAction).mockResolvedValue({ branch: 'agent/task-abc123', baseSha: undefined })
  })

  it('returns success and calls executeReviewAction with the revision feedback', async () => {
    const { service } = makeService()

    const result = await service.requestRevision({
      taskId: 'task-abc123',
      feedback: 'Please fix the types.',
      mode: 'resume'
    })

    expect(result.success).toBe(true)
    expect(executeReviewAction).toHaveBeenCalled()
  })

  it('propagates error when git op throws', async () => {
    vi.mocked(executeReviewAction).mockRejectedValueOnce(new Error('Worktree missing'))
    const { service } = makeService()

    await expect(
      service.requestRevision({
        taskId: 'task-abc123',
        feedback: 'Try again.',
        mode: 'fresh'
      })
    ).rejects.toThrow('Worktree missing')
  })

  it('throws when task is not found', async () => {
    const { service } = makeService(null)

    await expect(
      service.requestRevision({
        taskId: 'task-abc123',
        feedback: 'Please fix it.',
        mode: 'resume'
      })
    ).rejects.toThrow('not found')
  })
})

// ============================================================================
// discard
// ============================================================================

describe('discard', () => {
  beforeEach(() => {
    vi.mocked(executeReviewAction).mockResolvedValue({ branch: 'agent/task-abc123', baseSha: undefined })
  })

  it('returns success when the git op completes', async () => {
    const { service } = makeService()

    const result = await service.discard({
      taskId: 'task-abc123',
      env: TEST_ENV,
      onStatusTerminal: mockOnStatusTerminal
    })

    expect(result.success).toBe(true)
    expect(executeReviewAction).toHaveBeenCalled()
  })

  it('propagates error when git op throws', async () => {
    vi.mocked(executeReviewAction).mockRejectedValueOnce(new Error('Worktree already removed'))
    const { service } = makeService()

    await expect(
      service.discard({
        taskId: 'task-abc123',
        env: TEST_ENV,
        onStatusTerminal: mockOnStatusTerminal
      })
    ).rejects.toThrow('Worktree already removed')
  })

  it('throws when task is not found', async () => {
    const { service } = makeService(null)

    await expect(
      service.discard({
        taskId: 'task-abc123',
        env: TEST_ENV,
        onStatusTerminal: mockOnStatusTerminal
      })
    ).rejects.toThrow('not found')
  })
})

// ============================================================================
// createPr (shipIt via PR creation path)
// ============================================================================

describe('createPr', () => {
  beforeEach(() => {
    vi.mocked(execFileAsync).mockResolvedValue({ stdout: 'agent/task-abc123\n', stderr: '' })
    vi.mocked(createPullRequest).mockResolvedValue({
      success: true,
      prUrl: 'https://github.com/org/repo/pull/42',
      prNumber: 42
    })
  })

  it('returns success with the PR URL on the happy path', async () => {
    const { service } = makeService()

    const result = await service.createPr({
      taskId: 'task-abc123',
      title: 'feat: add widget',
      body: 'Closes #1',
      env: TEST_ENV,
      onStatusTerminal: mockOnStatusTerminal
    })

    expect(result.success).toBe(true)
    expect(result.prUrl).toBe('https://github.com/org/repo/pull/42')
  })

  it('notifies sprint mutation after PR fields are written', async () => {
    const { service } = makeService()

    await service.createPr({
      taskId: 'task-abc123',
      title: 'feat: add widget',
      body: 'Closes #1',
      env: TEST_ENV,
      onStatusTerminal: mockOnStatusTerminal
    })

    expect(mockNotifySprintMutation).toHaveBeenCalledWith('updated', expect.anything())
  })

  it('returns failure when PR creation service throws', async () => {
    vi.mocked(createPullRequest).mockRejectedValueOnce(new Error('gh CLI not found'))
    const { service } = makeService()

    const result = await service.createPr({
      taskId: 'task-abc123',
      title: 'feat: add widget',
      body: 'Closes #1',
      env: TEST_ENV,
      onStatusTerminal: mockOnStatusTerminal
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('gh CLI not found')
  })

  it('returns failure when task has no worktree_path', async () => {
    const taskWithoutWorktree = makeTask({ worktree_path: null })
    const { service } = makeService(taskWithoutWorktree)

    const result = await service.createPr({
      taskId: 'task-abc123',
      title: 'feat: add widget',
      body: 'Closes #1',
      env: TEST_ENV,
      onStatusTerminal: mockOnStatusTerminal
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('no worktree path')
  })
})

// ============================================================================
// rebase
// ============================================================================

describe('rebase', () => {
  it('returns success with baseSha on the happy path', async () => {
    vi.mocked(executeReviewAction).mockResolvedValue({ branch: 'agent/task-abc123', baseSha: 'abc123' })
    const { service } = makeService()

    const result = await service.rebase({ taskId: 'task-abc123', env: TEST_ENV })

    expect(result.success).toBe(true)
    expect(result.baseSha).toBe('abc123')
  })

  it('calls updateTask with rebase_base_sha when baseSha is present', async () => {
    vi.mocked(executeReviewAction).mockResolvedValue({ branch: 'agent/task-abc123', baseSha: 'abc123' })
    const { service } = makeService()

    await service.rebase({ taskId: 'task-abc123', env: TEST_ENV })

    expect(mockUpdateTask).toHaveBeenCalledWith(
      'task-abc123',
      expect.objectContaining({ rebase_base_sha: 'abc123' })
    )
  })

  it('returns failure with conflict list when git op throws a conflict error', async () => {
    const conflictError = Object.assign(new Error('Rebase failed'), {
      conflicts: ['src/foo.ts']
    })
    vi.mocked(executeReviewAction).mockRejectedValueOnce(conflictError)
    const { service } = makeService()

    const result = await service.rebase({ taskId: 'task-abc123', env: TEST_ENV })

    expect(result.success).toBe(false)
    expect(result.conflicts).toEqual(['src/foo.ts'])
  })

  it('returns failure when task is not found', async () => {
    const { service } = makeService(null)

    const result = await service.rebase({ taskId: 'task-abc123', env: TEST_ENV })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})
