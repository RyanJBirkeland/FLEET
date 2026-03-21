import type { AgentEvent, AgentHandle } from '../agents/types'
import { Watchdog } from './watchdog'

// --- Types ---

export interface AgentManagerConfig {
  maxConcurrent: number
  worktreeBase: string
  maxRuntimeMs: number
  idleMs: number
  drainIntervalMs: number
}

export interface QueuedTask {
  id: string
  title: string
  repo: string
  prompt: string | null
  priority: number
  status: string
  retry_count: number
  fast_fail_count: number
  template_name?: string | null
  spec?: string | null
}

export interface AgentManagerDeps {
  getQueuedTasks: () => Promise<QueuedTask[]>
  updateTask: (taskId: string, update: Record<string, unknown>) => Promise<void>
  ensureAuth: () => Promise<void>
  spawnAgent: (opts: { prompt: string; cwd: string; model?: string }) => Promise<AgentHandle>
  createWorktree: (repoPath: string, taskId: string, worktreeBase: string) => Promise<{ worktreePath: string; branch: string }>
  handleCompletion: (ctx: Record<string, unknown>) => Promise<void>
  emitEvent: (agentId: string, event: unknown) => void
  getRepoInfo: (repoName: string) => { repoPath: string; ghRepo: string } | null
  config: AgentManagerConfig
}

interface ActiveAgent {
  handle: AgentHandle
  watchdog: Watchdog
  taskId: string
}

// --- Helpers ---

function buildPrompt(task: QueuedTask): string {
  const parts: string[] = []
  if (task.spec) parts.push(task.spec)
  if (task.prompt) parts.push(task.prompt)
  if (parts.length === 0) parts.push(task.title)
  return parts.join('\n\n')
}

// --- AgentManager ---

export class AgentManager {
  private readonly deps: AgentManagerDeps
  private readonly active = new Map<string, ActiveAgent>()
  private drainInterval: ReturnType<typeof setInterval> | null = null

  constructor(deps: AgentManagerDeps) {
    this.deps = deps
  }

  start(): void {
    this.drainInterval = setInterval(() => {
      void this.drain()
    }, this.deps.config.drainIntervalMs)
  }

  stop(): void {
    if (this.drainInterval) {
      clearInterval(this.drainInterval)
      this.drainInterval = null
    }

    for (const [, entry] of this.active) {
      entry.watchdog.stop()
      void entry.handle.stop()
    }
    this.active.clear()
  }

  get activeCount(): number {
    return this.active.size
  }

  get availableSlots(): number {
    return this.deps.config.maxConcurrent - this.active.size
  }

  killAgent(taskId: string): boolean {
    const entry = this.active.get(taskId)
    if (!entry) return false

    entry.watchdog.stop()
    void entry.handle.stop()
    this.active.delete(taskId)
    return true
  }

  private async drain(): Promise<void> {
    const slots = this.availableSlots
    if (slots <= 0) return

    const tasks = await this.deps.getQueuedTasks()
    const toRun = tasks.slice(0, slots)

    for (const task of toRun) {
      void this.runTask(task)
    }
  }

  private async runTask(task: QueuedTask): Promise<void> {
    try {
      await this.deps.ensureAuth()

      const repoInfo = this.deps.getRepoInfo(task.repo)
      if (!repoInfo) {
        await this.deps.updateTask(task.id, {
          status: 'error',
          error: `Repository not found in settings: ${task.repo}`,
        })
        return
      }

      await this.deps.updateTask(task.id, {
        status: 'active',
      })

      const { worktreePath } = await this.deps.createWorktree(
        repoInfo.repoPath,
        task.id,
        this.deps.config.worktreeBase,
      )

      const prompt = buildPrompt(task)

      const handle = await this.deps.spawnAgent({
        prompt,
        cwd: worktreePath,
      })

      const watchdog = new Watchdog({
        maxRuntimeMs: this.deps.config.maxRuntimeMs,
        idleMs: this.deps.config.idleMs,
        onTimeout: () => {
          void handle.stop()
        },
      })
      watchdog.start()

      this.active.set(task.id, { handle, watchdog, taskId: task.id })

      void this.consumeEvents(handle, task, repoInfo, worktreePath)
    } catch (err) {
      await this.deps.updateTask(task.id, {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private async consumeEvents(
    handle: AgentHandle,
    task: QueuedTask,
    repoInfo: { repoPath: string; ghRepo: string },
    worktreePath: string,
  ): Promise<void> {
    try {
      for await (const event of handle.events) {
        const entry = this.active.get(task.id)
        if (entry) {
          entry.watchdog.ping()
        }

        this.deps.emitEvent(handle.id, event)

        if (event.type === 'agent:completed') {
          const completedEvent = event as Extract<AgentEvent, { type: 'agent:completed' }>

          this.active.delete(task.id)
          entry?.watchdog.stop()

          await this.deps.handleCompletion({
            taskId: task.id,
            agentId: handle.id,
            repoPath: repoInfo.repoPath,
            worktreePath,
            ghRepo: repoInfo.ghRepo,
            exitCode: completedEvent.exitCode,
            worktreeBase: this.deps.config.worktreeBase,
            retryCount: task.retry_count,
            fastFailCount: task.fast_fail_count,
            durationMs: completedEvent.durationMs,
          })
        }
      }
    } catch {
      // Event stream ended unexpectedly — clean up
      this.active.delete(task.id)
    }
  }
}
