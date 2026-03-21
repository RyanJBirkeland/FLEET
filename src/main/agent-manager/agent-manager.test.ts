import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AgentEvent, AgentHandle } from '../agents/types'
import { AgentManager } from './agent-manager'
import type { AgentManagerDeps, AgentManagerConfig, QueuedTask } from './agent-manager'

// --- Helpers ---

function makeConfig(overrides: Partial<AgentManagerConfig> = {}): AgentManagerConfig {
  return {
    maxConcurrent: 2,
    worktreeBase: '/tmp/worktrees',
    maxRuntimeMs: 600_000,
    idleMs: 120_000,
    drainIntervalMs: 5_000,
    ...overrides,
  }
}

function makeTask(overrides: Partial<QueuedTask> = {}): QueuedTask {
  return {
    id: 'task-1',
    title: 'Fix the bug',
    repo: 'my-repo',
    prompt: 'Please fix the bug in auth.ts',
    priority: 1,
    status: 'queued',
    retry_count: 0,
    fast_fail_count: 0,
    ...overrides,
  }
}

function makeMockAgentHandle(events: AgentEvent[] = []): AgentHandle {
  return {
    id: 'agent-123',
    pid: 12345,
    logPath: '/tmp/logs/agent-123.log',
    events: (async function* () {
      for (const event of events) {
        yield event
      }
    })(),
    steer: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  }
}

function makeDeps(overrides: Partial<AgentManagerDeps> = {}): AgentManagerDeps {
  return {
    getQueuedTasks: vi.fn().mockResolvedValue([]),
    updateTask: vi.fn().mockResolvedValue(undefined),
    ensureAuth: vi.fn().mockResolvedValue(undefined),
    spawnAgent: vi.fn().mockResolvedValue(makeMockAgentHandle()),
    createWorktree: vi.fn().mockResolvedValue({ worktreePath: '/tmp/worktrees/task-1', branch: 'agent/task-1' }),
    handleCompletion: vi.fn().mockResolvedValue(undefined),
    emitEvent: vi.fn(),
    getRepoInfo: vi.fn().mockReturnValue({ repoPath: '/repos/my-repo', ghRepo: 'owner/my-repo' }),
    config: makeConfig(),
    ...overrides,
  }
}

// --- Tests ---

describe('AgentManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('start / stop', () => {
    it('starts a drain loop that calls drain on interval', async () => {
      const task = makeTask()
      const completedEvent: AgentEvent = {
        type: 'agent:completed',
        exitCode: 0,
        costUsd: 0.01,
        tokensIn: 100,
        tokensOut: 50,
        durationMs: 5000,
        timestamp: Date.now(),
      }
      const handle = makeMockAgentHandle([completedEvent])
      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        spawnAgent: vi.fn().mockResolvedValue(handle),
      })

      const manager = new AgentManager(deps)
      manager.start()

      // Advance past the first drain interval
      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      expect(deps.getQueuedTasks).toHaveBeenCalled()

      manager.stop()
    })

    it('stops the drain loop when stop() is called', async () => {
      const deps = makeDeps()
      const manager = new AgentManager(deps)

      manager.start()
      manager.stop()

      // Advance well past the drain interval
      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs * 5)

      // getQueuedTasks should NOT have been called since stop() was called before any drain
      expect(deps.getQueuedTasks).not.toHaveBeenCalled()
    })
  })

  describe('drain', () => {
    it('drains a queued task when started (verifies ensureAuth, createWorktree, spawnAgent)', async () => {
      const task = makeTask()
      const completedEvent: AgentEvent = {
        type: 'agent:completed',
        exitCode: 0,
        costUsd: 0.01,
        tokensIn: 100,
        tokensOut: 50,
        durationMs: 5000,
        timestamp: Date.now(),
      }
      const handle = makeMockAgentHandle([completedEvent])
      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        spawnAgent: vi.fn().mockResolvedValue(handle),
      })

      const manager = new AgentManager(deps)
      manager.start()

      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      expect(deps.ensureAuth).toHaveBeenCalled()
      expect(deps.createWorktree).toHaveBeenCalledWith('/repos/my-repo', 'task-1', '/tmp/worktrees')
      expect(deps.spawnAgent).toHaveBeenCalledWith({
        prompt: expect.any(String),
        cwd: '/tmp/worktrees/task-1',
      })

      manager.stop()
    })

    it('respects concurrency limit (max 1 slot, 2 tasks -> only 1 spawned)', async () => {
      const task1 = makeTask({ id: 'task-1', title: 'Task 1' })
      const task2 = makeTask({ id: 'task-2', title: 'Task 2' })

      // The first agent never completes (no events that finish)
      const hangingHandle = makeMockAgentHandle([])
      // Override the events to be a generator that never yields
      hangingHandle.events = (async function* () {
        // Block indefinitely
        await new Promise(() => {})
      })()

      const spawnAgent = vi.fn().mockResolvedValue(hangingHandle)
      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValue([task1, task2]),
        spawnAgent,
        config: makeConfig({ maxConcurrent: 1 }),
      })

      const manager = new AgentManager(deps)
      manager.start()

      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      // Only 1 agent should be spawned due to maxConcurrent: 1
      expect(spawnAgent).toHaveBeenCalledTimes(1)

      manager.stop()
    })

    it('sets error status if repo not found in settings', async () => {
      const task = makeTask({ repo: 'unknown-repo' })
      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        getRepoInfo: vi.fn().mockReturnValue(null),
      })

      const manager = new AgentManager(deps)
      manager.start()

      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      expect(deps.updateTask).toHaveBeenCalledWith('task-1', {
        status: 'error',
        error: expect.stringContaining('unknown-repo'),
      })

      manager.stop()
    })
  })

  describe('buildPrompt', () => {
    it('builds prompt from spec + prompt fields', async () => {
      const task = makeTask({
        spec: 'Specification text here',
        prompt: 'Extra prompt instructions',
      })
      const completedEvent: AgentEvent = {
        type: 'agent:completed',
        exitCode: 0,
        costUsd: 0.01,
        tokensIn: 100,
        tokensOut: 50,
        durationMs: 5000,
        timestamp: Date.now(),
      }
      const handle = makeMockAgentHandle([completedEvent])
      const spawnAgent = vi.fn().mockResolvedValue(handle)
      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        spawnAgent,
      })

      const manager = new AgentManager(deps)
      manager.start()

      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      const call = spawnAgent.mock.calls[0][0]
      expect(call.prompt).toBe('Specification text here\n\nExtra prompt instructions')

      manager.stop()
    })

    it('falls back to title when spec and prompt are absent', async () => {
      const task = makeTask({
        prompt: null,
        spec: null,
      })
      const completedEvent: AgentEvent = {
        type: 'agent:completed',
        exitCode: 0,
        costUsd: 0.01,
        tokensIn: 100,
        tokensOut: 50,
        durationMs: 5000,
        timestamp: Date.now(),
      }
      const handle = makeMockAgentHandle([completedEvent])
      const spawnAgent = vi.fn().mockResolvedValue(handle)
      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        spawnAgent,
      })

      const manager = new AgentManager(deps)
      manager.start()

      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      const call = spawnAgent.mock.calls[0][0]
      expect(call.prompt).toBe('Fix the bug')

      manager.stop()
    })

    it('uses only prompt when spec is absent', async () => {
      const task = makeTask({
        spec: null,
        prompt: 'Just the prompt',
      })
      const completedEvent: AgentEvent = {
        type: 'agent:completed',
        exitCode: 0,
        costUsd: 0.01,
        tokensIn: 100,
        tokensOut: 50,
        durationMs: 5000,
        timestamp: Date.now(),
      }
      const handle = makeMockAgentHandle([completedEvent])
      const spawnAgent = vi.fn().mockResolvedValue(handle)
      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        spawnAgent,
      })

      const manager = new AgentManager(deps)
      manager.start()

      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      const call = spawnAgent.mock.calls[0][0]
      expect(call.prompt).toBe('Just the prompt')

      manager.stop()
    })
  })

  describe('completion handling', () => {
    it('calls handleCompletion when agent completes', async () => {
      const task = makeTask()
      const completedEvent: AgentEvent = {
        type: 'agent:completed',
        exitCode: 0,
        costUsd: 0.05,
        tokensIn: 500,
        tokensOut: 200,
        durationMs: 45_000,
        timestamp: Date.now(),
      }
      const handle = makeMockAgentHandle([completedEvent])
      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        spawnAgent: vi.fn().mockResolvedValue(handle),
      })

      const manager = new AgentManager(deps)
      manager.start()

      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      // Allow microtasks to settle for the event consumption
      await vi.advanceTimersByTimeAsync(0)

      expect(deps.handleCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          exitCode: 0,
          durationMs: 45_000,
        }),
      )

      manager.stop()
    })

    it('emits events via deps.emitEvent as they arrive', async () => {
      const task = makeTask()
      const textEvent: AgentEvent = {
        type: 'agent:text',
        text: 'Hello world',
        timestamp: Date.now(),
      }
      const completedEvent: AgentEvent = {
        type: 'agent:completed',
        exitCode: 0,
        costUsd: 0.01,
        tokensIn: 100,
        tokensOut: 50,
        durationMs: 5000,
        timestamp: Date.now(),
      }
      const handle = makeMockAgentHandle([textEvent, completedEvent])
      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        spawnAgent: vi.fn().mockResolvedValue(handle),
      })

      const manager = new AgentManager(deps)
      manager.start()

      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)
      await vi.advanceTimersByTimeAsync(0)

      expect(deps.emitEvent).toHaveBeenCalledWith('agent-123', textEvent)
      expect(deps.emitEvent).toHaveBeenCalledWith('agent-123', completedEvent)

      manager.stop()
    })
  })

  describe('killAgent', () => {
    it('stops the agent and returns true for an active task', async () => {
      const task = makeTask()
      // Agent that never completes on its own
      const handle = makeMockAgentHandle([])
      handle.events = (async function* () {
        await new Promise(() => {})
      })()

      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        spawnAgent: vi.fn().mockResolvedValue(handle),
      })

      const manager = new AgentManager(deps)
      manager.start()

      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      expect(manager.activeCount).toBe(1)

      const killed = manager.killAgent('task-1')
      expect(killed).toBe(true)
      expect(handle.stop).toHaveBeenCalled()

      manager.stop()
    })

    it('returns false for a non-existent task', () => {
      const deps = makeDeps()
      const manager = new AgentManager(deps)

      const killed = manager.killAgent('non-existent')
      expect(killed).toBe(false)
    })
  })

  describe('activeCount / availableSlots', () => {
    it('reports correct counts', async () => {
      const task = makeTask()
      const handle = makeMockAgentHandle([])
      handle.events = (async function* () {
        await new Promise(() => {})
      })()

      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        spawnAgent: vi.fn().mockResolvedValue(handle),
        config: makeConfig({ maxConcurrent: 3 }),
      })

      const manager = new AgentManager(deps)

      expect(manager.activeCount).toBe(0)
      expect(manager.availableSlots).toBe(3)

      manager.start()
      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      expect(manager.activeCount).toBe(1)
      expect(manager.availableSlots).toBe(2)

      manager.stop()
    })
  })

  describe('task status update', () => {
    it('sets task to active status when starting runTask', async () => {
      const task = makeTask()
      const completedEvent: AgentEvent = {
        type: 'agent:completed',
        exitCode: 0,
        costUsd: 0.01,
        tokensIn: 100,
        tokensOut: 50,
        durationMs: 5000,
        timestamp: Date.now(),
      }
      const handle = makeMockAgentHandle([completedEvent])
      const deps = makeDeps({
        getQueuedTasks: vi.fn().mockResolvedValueOnce([task]).mockResolvedValue([]),
        spawnAgent: vi.fn().mockResolvedValue(handle),
      })

      const manager = new AgentManager(deps)
      manager.start()

      await vi.advanceTimersByTimeAsync(deps.config.drainIntervalMs)

      // First call to updateTask should set status to 'active'
      expect(deps.updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({
        status: 'active',
      }))

      manager.stop()
    })
  })
})
