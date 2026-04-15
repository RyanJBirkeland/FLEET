/**
 * Task claimer — maps raw DB rows to AgentRunClaim, verifies fresh status,
 * checks dependency blocking, resolves repo paths, and claims the task atomically.
 *
 * Extracted from AgentManagerImpl._validateAndClaimTask and
 * _processQueuedTask so the logic is unit-testable in isolation.
 */

import type { Logger } from '../logger'
import { logError } from '../logger'
import type { AgentManagerConfig, ActiveAgent } from './types'
import { EXECUTOR_ID, NOTES_MAX_LENGTH } from './types'
import type { IAgentTaskRepository } from '../data/sprint-task-repository'
import type { DependencyIndex } from '../services/dependency-service'
import { mapQueuedTask, checkAndBlockDeps, type MappedTask } from './task-mapper'
import { getRepoPaths } from '../paths'
import { setupWorktree } from './worktree'
import { nowIso } from '../../shared/time'
import type { AgentRunClaim } from './run-agent'

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

export interface TaskClaimerDeps {
  config: AgentManagerConfig
  repo: IAgentTaskRepository
  depIndex: DependencyIndex
  logger: Logger
  onTaskTerminal: (taskId: string, status: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Repo path resolution
// ---------------------------------------------------------------------------

/**
 * Look up the local filesystem path for `repoSlug`.
 * Returns null when the slug is not configured in BDE settings.
 */
export function resolveRepoPath(repoSlug: string): string | null {
  const repoPaths = getRepoPaths()
  return repoPaths[repoSlug.toLowerCase()] ?? null
}

// ---------------------------------------------------------------------------
// Claim helpers
// ---------------------------------------------------------------------------

/**
 * Map the raw DB row, verify the task is still queued (fresh status guard),
 * block on unsatisfied hard deps, resolve the repo path, and claim the task
 * atomically.
 *
 * Returns `{ task, repoPath }` on success or `null` to signal "skip this task".
 */
export async function validateAndClaimTask(
  raw: Record<string, unknown>,
  taskStatusMap: Map<string, string>,
  deps: TaskClaimerDeps
): Promise<{ task: MappedTask; repoPath: string } | null> {
  const task = mapQueuedTask(raw, deps.logger)
  if (!task) return null

  // Fresh-status guard — the task may have been claimed by another drain tick
  // or changed status externally between the batch fetch and this point.
  const freshTask = deps.repo.getTask(task.id)
  if (!freshTask || freshTask.status !== 'queued') {
    deps.logger.info(
      `[agent-manager] Task ${task.id} status changed since fetch (was queued, now ${freshTask?.status ?? 'not found'}) — skipping`
    )
    return null
  }

  const rawDeps = raw.dependsOn ?? raw.depends_on
  if (
    rawDeps &&
    checkAndBlockDeps(task.id, rawDeps, taskStatusMap, deps.repo, deps.depIndex, deps.logger)
  ) {
    return null
  }

  const repoPath = resolveRepoPath(task.repo)
  if (!repoPath) {
    deps.logger.warn(
      `[agent-manager] No repo path for "${task.repo}" — setting task ${task.id} to error`
    )
    try {
      deps.repo.updateTask(task.id, {
        status: 'error',
        notes: `Repo "${task.repo}" is not configured in BDE settings. Add it in Settings > Repos, then reset this task to queued.`,
        claimed_by: null
      })
    } catch (err) {
      deps.logger.warn(
        `[agent-manager] Failed to update task ${task.id} after repo resolution failure: ${err}`
      )
    }
    await deps.onTaskTerminal(task.id, 'error').catch((err) =>
      deps.logger.warn(`[agent-manager] onTerminal failed for ${task.id}: ${err}`)
    )
    return null
  }

  const claimed = deps.repo.claimTask(task.id, EXECUTOR_ID, deps.config.maxConcurrent) !== null
  if (!claimed) {
    deps.logger.info(`[agent-manager] Task ${task.id} already claimed — skipping`)
    return null
  }

  return { task, repoPath }
}

// ---------------------------------------------------------------------------
// Worktree preparation (lives here because it is tightly coupled to claiming)
// ---------------------------------------------------------------------------

/**
 * Create or reuse the git worktree for `task`.
 * Returns the worktree descriptor on success, or `null` on failure after
 * marking the task as `error` and notifying the terminal handler.
 */
export async function prepareWorktreeForTask(
  task: MappedTask,
  repoPath: string,
  deps: TaskClaimerDeps
): Promise<{ worktreePath: string; branch: string } | null> {
  try {
    return await setupWorktree({
      repoPath,
      worktreeBase: deps.config.worktreeBase,
      taskId: task.id,
      title: task.title,
      groupId: task.group_id ?? undefined,
      logger: deps.logger
    })
  } catch (err) {
    logError(deps.logger, `[agent-manager] setupWorktree failed for task ${task.id}`, err)
    const errMsg = err instanceof Error ? err.message : String(err)
    const fullNote = `Worktree setup failed: ${errMsg}`
    const notes =
      fullNote.length > NOTES_MAX_LENGTH
        ? '...' + fullNote.slice(-(NOTES_MAX_LENGTH - 3))
        : fullNote
    deps.repo.updateTask(task.id, {
      status: 'error',
      completed_at: nowIso(),
      notes,
      claimed_by: null
    })
    await deps.onTaskTerminal(task.id, 'error').catch((err) =>
      deps.logger.warn(`[agent-manager] onTerminal failed for ${task.id}: ${err}`)
    )
    return null
  }
}

// ---------------------------------------------------------------------------
// Full task-processing pipeline
// ---------------------------------------------------------------------------

export interface ProcessQueuedTaskDeps extends TaskClaimerDeps {
  processingTasks: Set<string>
  activeAgents: Map<string, ActiveAgent>
  spawnAgent: (
    task: AgentRunClaim,
    worktree: { worktreePath: string; branch: string },
    repoPath: string
  ) => void
}

/**
 * Full pipeline for one queued task row: idempotency guard → claim →
 * worktree setup → spawn agent.
 *
 * Refreshes the task-status map after a successful claim to reduce stale-state
 * windows when processing subsequent tasks in the same drain tick.
 */
export async function processQueuedTask(
  raw: Record<string, unknown>,
  taskStatusMap: Map<string, string>,
  deps: ProcessQueuedTaskDeps
): Promise<void> {
  const taskId = raw.id as string
  if (deps.processingTasks.has(taskId)) return
  deps.processingTasks.add(taskId)
  try {
    const claimed = await validateAndClaimTask(raw, taskStatusMap, deps)
    if (!claimed) return

    const { task, repoPath } = claimed

    // Refresh the task-status map after claiming to minimise stale-state windows
    // for subsequent tasks in the same drain tick.
    try {
      const freshTasks = deps.repo.getTasksWithDependencies()
      taskStatusMap.clear()
      for (const t of freshTasks) {
        taskStatusMap.set(t.id, t.status)
      }
    } catch {
      // non-fatal: stale map is better than aborting the drain
    }

    const wt = await prepareWorktreeForTask(task, repoPath, deps)
    if (!wt) return

    deps.spawnAgent(task, wt, repoPath)
  } finally {
    deps.processingTasks.delete(taskId)
  }
}
