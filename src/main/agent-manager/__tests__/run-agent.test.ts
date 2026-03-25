/**
 * Tests for run-agent.ts failure modes: spawn failures, auth errors,
 * watchdog race, fast-fail paths, and completion fallback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAgent } from '../run-agent'
import type { RunAgentTask, RunAgentDeps } from '../run-agent'
import type { ActiveAgent } from '../types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../fast-fail', () => ({
  classifyExit: vi.fn().mockReturnValue('normal-exit'),
}))

vi.mock('../worktree', () => ({
  cleanupWorktree: vi.fn(),
}))

vi.mock('../sdk-adapter', () => ({
  spawnAgent: vi.fn(),
}))

vi.mock('../completion', () => ({
  resolveSuccess: vi.fn().mockResolvedValue(undefined),
  resolveFailure: vi.fn().mockResolvedValue(false),
}))

vi.mock('../../data/sprint-queries', () => ({
  updateTask: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../paths', () => ({
  getGhRepo: vi.fn().mockReturnValue('owner/repo'),
}))

vi.mock('../../agent-history', () => ({
  createAgentRecord: vi.fn().mockResolvedValue(undefined),
  updateAgentMeta: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../broadcast', () => ({
  broadcast: vi.fn(),
}))

vi.mock('../../env-utils', () => ({
  invalidateOAuthToken: vi.fn(),
  refreshOAuthTokenFromKeychain: vi.fn().mockResolvedValue(false),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<RunAgentTask> = {}): RunAgentTask {
  return {
    id: 'task-1',
    title: 'Test task',
    prompt: 'Do something',
    spec: null,
    repo: 'BDE',
    retry_count: 0,
    fast_fail_count: 0,
    ...overrides,
  }
}

function makeDeps(overrides: Partial<RunAgentDeps> = {}): RunAgentDeps {
  return {
    activeAgents: new Map<string, ActiveAgent>(),
    defaultModel: 'claude-sonnet-4-5',
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    onTaskTerminal: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const worktree = { worktreePath: '/tmp/wt', branch: 'agent/test' }
const repoPath = '/repo'

/** Creates a mock AgentHandle whose message iterator yields given messages then completes */
function makeHandle(messages: unknown[] = [{ exit_code: 0 }]) {
  return {
    messages: {
      async *[Symbol.asyncIterator]() {
        for (const m of messages) yield m
      },
    },
    result: Promise.resolve({ exitCode: 0 }),
  }
}

/** Creates a mock AgentHandle whose message iterator throws */
function makeErrorHandle(error: Error) {
  return {
    messages: {
      async *[Symbol.asyncIterator]() {
        throw error
      },
    },
    result: Promise.resolve({ exitCode: 1 }),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAgent — spawn failures', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks task as error when spawn times out', async () => {
    const { spawnAgent } = await import('../sdk-adapter')
    const { updateTask } = await import('../../data/sprint-queries')
    const { cleanupWorktree } = await import('../worktree')

    // spawnAgent never resolves
    ;(spawnAgent as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))

    // Override SPAWN_TIMEOUT_MS by making the race lose to a short timeout
    // We can't easily override the constant, so instead we make spawnAgent reject quickly
    ;(spawnAgent as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Spawn timed out after 60s'))

    const deps = makeDeps()
    await runAgent(makeTask(), worktree, repoPath, deps)

    expect(updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        status: 'error',
        notes: expect.stringContaining('Spawn failed:'),
        claimed_by: null,
      }),
    )
    expect(deps.onTaskTerminal).toHaveBeenCalledWith('task-1', 'error')
    expect(cleanupWorktree).toHaveBeenCalledWith(
      expect.objectContaining({ repoPath, worktreePath: worktree.worktreePath, branch: worktree.branch }),
    )
  })

  it('marks task as error when spawn rejects with a specific error', async () => {
    const { spawnAgent } = await import('../sdk-adapter')
    const { updateTask } = await import('../../data/sprint-queries')
    const { cleanupWorktree } = await import('../worktree')

    ;(spawnAgent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('ENOENT: claude binary not found'),
    )

    const deps = makeDeps()
    await runAgent(makeTask(), worktree, repoPath, deps)

    expect(updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        status: 'error',
        notes: expect.stringContaining('ENOENT: claude binary not found'),
      }),
    )
    expect(deps.onTaskTerminal).toHaveBeenCalledWith('task-1', 'error')
    expect(cleanupWorktree).toHaveBeenCalled()
  })
})

describe('runAgent — auth error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invalidates OAuth token on "Invalid API key" error', async () => {
    const { spawnAgent } = await import('../sdk-adapter')
    const { invalidateOAuthToken } = await import('../../env-utils')

    ;(spawnAgent as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeErrorHandle(new Error('Invalid API key')),
    )

    const deps = makeDeps()
    await runAgent(makeTask(), worktree, repoPath, deps)

    expect(invalidateOAuthToken).toHaveBeenCalled()
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Auth failure detected'),
    )
  })
})

describe('runAgent — watchdog race', () => {
  beforeEach(() => vi.clearAllMocks())

  it('logs "already cleaned up by watchdog" and does not call resolveSuccess', async () => {
    const { spawnAgent } = await import('../sdk-adapter')
    const { resolveSuccess } = await import('../completion')
    const { cleanupWorktree } = await import('../worktree')

    const activeAgents = new Map<string, ActiveAgent>()

    // After messages are consumed, activeAgents should NOT have task.id
    // We achieve this by deleting from activeAgents during message iteration
    const handle = {
      messages: {
        async *[Symbol.asyncIterator]() {
          yield { exit_code: 0 }
          // Simulate watchdog removing the agent between message loop end and the check
          activeAgents.delete('task-1')
        },
      },
      result: Promise.resolve({ exitCode: 0 }),
    }

    ;(spawnAgent as ReturnType<typeof vi.fn>).mockResolvedValue(handle)

    const deps = makeDeps({ activeAgents })
    await runAgent(makeTask(), worktree, repoPath, deps)

    expect(deps.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('already cleaned up by watchdog'),
    )
    expect(resolveSuccess).not.toHaveBeenCalled()
    expect(cleanupWorktree).toHaveBeenCalled()
  })
})

describe('runAgent — fast-fail paths', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks task as error when classifyExit returns fast-fail-exhausted', async () => {
    const { spawnAgent } = await import('../sdk-adapter')
    const { classifyExit } = await import('../fast-fail')
    const { updateTask } = await import('../../data/sprint-queries')

    ;(spawnAgent as ReturnType<typeof vi.fn>).mockResolvedValue(makeHandle([{ exit_code: 1 }]))
    ;(classifyExit as ReturnType<typeof vi.fn>).mockReturnValue('fast-fail-exhausted')

    const deps = makeDeps()
    await runAgent(makeTask({ fast_fail_count: 2 }), worktree, repoPath, deps)

    expect(updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        status: 'error',
        notes: 'Fast-fail exhausted',
        claimed_by: null,
      }),
    )
    expect(deps.onTaskTerminal).toHaveBeenCalledWith('task-1', 'error')
  })

  it('requeues task with incremented fast_fail_count when classifyExit returns fast-fail-requeue', async () => {
    const { spawnAgent } = await import('../sdk-adapter')
    const { classifyExit } = await import('../fast-fail')
    const { updateTask } = await import('../../data/sprint-queries')

    ;(spawnAgent as ReturnType<typeof vi.fn>).mockResolvedValue(makeHandle([{ exit_code: 1 }]))
    ;(classifyExit as ReturnType<typeof vi.fn>).mockReturnValue('fast-fail-requeue')

    const deps = makeDeps()
    await runAgent(makeTask({ fast_fail_count: 1 }), worktree, repoPath, deps)

    expect(updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        status: 'queued',
        fast_fail_count: 2,
        claimed_by: null,
      }),
    )
    // onTaskTerminal should NOT be called for requeue
    expect(deps.onTaskTerminal).not.toHaveBeenCalledWith('task-1', 'error')
  })
})

describe('runAgent — completion fallback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls resolveFailure when resolveSuccess throws, and calls onTaskTerminal if terminal', async () => {
    const { spawnAgent } = await import('../sdk-adapter')
    const { classifyExit } = await import('../fast-fail')
    const { resolveSuccess, resolveFailure } = await import('../completion')

    ;(spawnAgent as ReturnType<typeof vi.fn>).mockResolvedValue(makeHandle([{ exit_code: 0 }]))
    ;(classifyExit as ReturnType<typeof vi.fn>).mockReturnValue('normal-exit')
    ;(resolveSuccess as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('PR creation failed'))
    ;(resolveFailure as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    const deps = makeDeps()
    await runAgent(makeTask(), worktree, repoPath, deps)

    expect(resolveFailure).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-1', retryCount: 0 }),
      deps.logger,
    )
    expect(deps.onTaskTerminal).toHaveBeenCalledWith('task-1', 'failed')
  })

  it('does NOT call onTaskTerminal when resolveFailure returns false (retry queued)', async () => {
    const { spawnAgent } = await import('../sdk-adapter')
    const { classifyExit } = await import('../fast-fail')
    const { resolveSuccess, resolveFailure } = await import('../completion')

    ;(spawnAgent as ReturnType<typeof vi.fn>).mockResolvedValue(makeHandle([{ exit_code: 0 }]))
    ;(classifyExit as ReturnType<typeof vi.fn>).mockReturnValue('normal-exit')
    ;(resolveSuccess as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('PR creation failed'))
    ;(resolveFailure as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const deps = makeDeps()
    await runAgent(makeTask(), worktree, repoPath, deps)

    expect(resolveFailure).toHaveBeenCalled()
    expect(deps.onTaskTerminal).not.toHaveBeenCalled()
  })
})
