import { describe, it, expect, vi, afterEach } from 'vitest'
import { createStatusServer } from '../status-server'

describe('status-server', () => {
  let server: ReturnType<typeof createStatusServer>

  afterEach(() => {
    server?.stop()
  })

  it('returns JSON status on GET /status', async () => {
    const mockAgentManager = {
      getStatus: vi.fn().mockReturnValue({
        running: true,
        shuttingDown: false,
        concurrency: { maxConcurrent: 2, activeCount: 1, backpressureActive: false },
        activeAgents: [
          {
            taskId: 'task-1',
            agentRunId: 'run-1',
            model: 'claude-sonnet-4-5',
            startedAt: Date.now(),
            lastOutputAt: Date.now(),
            rateLimitCount: 0
          }
        ]
      }),
      getMetrics: vi.fn().mockReturnValue({
        drainLoopCount: 5,
        tasksClaimed: 3,
        tasksCompleted: 2,
        tasksFailed: 0,
        agentsSpawned: 3,
        totalCostUsd: 0.15,
        uptime: 120000
      })
    }
    const mockRepo = {
      getQueueStats: vi.fn().mockReturnValue({
        backlog: 0,
        queued: 2,
        blocked: 0,
        active: 1,
        review: 0,
        done: 5,
        failed: 0,
        cancelled: 0,
        error: 0
      })
    }
    server = createStatusServer(mockAgentManager as any, mockRepo as any, 0) // port 0 = random
    const port = await server.start()
    const res = await fetch(`http://127.0.0.1:${port}/status`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')
    const body = await res.json()
    expect(body.agentManager.running).toBe(true)
    expect(body.agentManager.activeAgents).toHaveLength(1)
    expect(body.metrics.drainLoopCount).toBe(5)
    expect(body.queue.queued).toBe(2)
    expect(body.queue.active).toBe(1)
    expect(body.ts).toBeDefined()
  })

  it('returns 404 on unknown paths', async () => {
    const mockAgentManager = {
      getStatus: vi.fn(),
      getMetrics: vi.fn()
    }
    const mockRepo = {
      getQueueStats: vi.fn()
    }
    server = createStatusServer(mockAgentManager as any, mockRepo as any, 0)
    const port = await server.start()
    const res = await fetch(`http://127.0.0.1:${port}/other`)
    expect(res.status).toBe(404)
  })

  it('returns 405 on non-GET requests to /status', async () => {
    const mockAgentManager = {
      getStatus: vi.fn(),
      getMetrics: vi.fn()
    }
    const mockRepo = {
      getQueueStats: vi.fn()
    }
    server = createStatusServer(mockAgentManager as any, mockRepo as any, 0)
    const port = await server.start()
    const res = await fetch(`http://127.0.0.1:${port}/status`, { method: 'POST' })
    expect(res.status).toBe(405)
  })

  it('handles errors in status generation gracefully', async () => {
    const mockAgentManager = {
      getStatus: vi.fn().mockImplementation(() => {
        throw new Error('Status error')
      }),
      getMetrics: vi.fn()
    }
    const mockRepo = {
      getQueueStats: vi.fn()
    }
    server = createStatusServer(mockAgentManager as any, mockRepo as any, 0)
    const port = await server.start()
    const res = await fetch(`http://127.0.0.1:${port}/status`)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('can stop and restart the server', async () => {
    const mockAgentManager = {
      getStatus: vi.fn().mockReturnValue({ running: true, activeAgents: [] }),
      getMetrics: vi.fn().mockReturnValue({ drainLoopCount: 0 })
    }
    const mockRepo = {
      getQueueStats: vi.fn().mockReturnValue({ queued: 0, active: 0, done: 0 })
    }
    server = createStatusServer(mockAgentManager as any, mockRepo as any, 0)
    await server.start()
    server.stop()

    // Should be able to restart
    const port2 = await server.start()
    const res = await fetch(`http://127.0.0.1:${port2}/status`)
    expect(res.status).toBe(200)
  })
})
