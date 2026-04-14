import type { IAgentTaskRepository } from '../data/sprint-task-repository'
import { EXECUTOR_ID } from './types'

export async function recoverOrphans(
  isAgentActive: (taskId: string) => boolean,
  repo: IAgentTaskRepository,
  logger: { info: (msg: string) => void; warn: (msg: string) => void }
): Promise<number> {
  const orphans = repo.getOrphanedTasks(EXECUTOR_ID)
  let recovered = 0

  for (const task of orphans) {
    if (isAgentActive(task.id)) continue // still running

    // Skip tasks that already have a PR — they completed successfully and are
    // waiting for SprintPrPoller to mark them done on merge.
    if (task.pr_url || task.pr_status === 'branch_only') {
      logger.info(
        `[agent-manager] Task ${task.id} "${task.title}" has PR ${task.pr_url} — not orphaned, clearing claimed_by`
      )
      repo.updateTask(task.id, { claimed_by: null })
      continue
    }

    logger.warn(`[agent-manager] Orphaned task ${task.id} "${task.title}" — re-queuing`)

    // Re-queue: clear claimed_by so drain loop or external runner can pick it up.
    // Do NOT increment retry_count — orphaning is a process crash, not a task failure.
    // retry_count is only incremented by agent failure paths in completion.ts.
    repo.updateTask(task.id, {
      status: 'queued',
      claimed_by: null,
      notes: `Task was re-queued by orphan recovery. Agent process terminated without completing the task.`
    })
    recovered++
  }

  // Reconcile agent_runs: finalize any DB records marked 'running' whose
  // agent is no longer in the in-memory active set (crashed without cleanup).
  try {
    const { reconcileRunningAgentRuns } = await import('../agent-history')
    const cleaned = reconcileRunningAgentRuns(isAgentActive)
    if (cleaned > 0) logger.info(`[agent-manager] Reconciled ${cleaned} stale agent_runs records`)
  } catch {
    /* best-effort */
  }

  return recovered
}
