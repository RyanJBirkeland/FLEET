import type { SprintTask } from '../../../shared/types'
import { PR_STATUS } from '../../../shared/constants'
import { STATUS_METADATA } from './task-status-ui'

export interface SprintPartition {
  backlog: SprintTask[]
  todo: SprintTask[]
  blocked: SprintTask[]
  inProgress: SprintTask[]
  /** Tasks with status 'review' — agent done, awaiting human action in Code Review Station. */
  pendingReview: SprintTask[]
  /** Tasks with status 'approved' — review passed, queued for PR group inclusion. */
  approved: SprintTask[]
  /** Tasks with status 'active' and pr_status 'open'|'branch_only' — open GitHub PRs. */
  openPrs: SprintTask[]
  done: SprintTask[]
  failed: SprintTask[]
}

/**
 * Partition sprint tasks into 9 mutually exclusive buckets.
 * Every task lands in exactly one bucket — no overlap.
 *
 * Status mapping:
 *   backlog              → backlog
 *   queued               → todo
 *   blocked              → blocked
 *   active               → inProgress (max 5 enforced at UI layer)
 *   active + pr_status=open|branch_only → openPrs
 *   review               → pendingReview
 *   approved             → approved
 *   done + pr_status=merged|closed|null|draft → done
 *   cancelled            → failed (dimmed at bottom of Done column)
 */
export function partitionSprintTasks(tasks: SprintTask[]): SprintPartition {
  const backlog: SprintTask[] = []
  const todo: SprintTask[] = []
  const blocked: SprintTask[] = []
  const inProgress: SprintTask[] = []
  const pendingReview: SprintTask[] = []
  const approved: SprintTask[] = []
  const openPrs: SprintTask[] = []
  const done: SprintTask[] = []
  const failed: SprintTask[] = []

  for (const task of tasks) {
    // Special case: active tasks with an open PR go to openPrs
    // (depends on both status and pr_status — can't be metadata-driven)
    if (
      task.status === 'active' &&
      (task.pr_status === PR_STATUS.OPEN || task.pr_status === PR_STATUS.BRANCH_ONLY)
    ) {
      openPrs.push(task)
      continue
    }

    // All other statuses: route via metadata.bucketKey
    const bucketKey = STATUS_METADATA[task.status].bucketKey
    switch (bucketKey) {
      case 'backlog':
        backlog.push(task)
        break
      case 'todo':
        todo.push(task)
        break
      case 'blocked':
        blocked.push(task)
        break
      case 'inProgress':
        inProgress.push(task)
        break
      case 'awaitingReview':
        pendingReview.push(task)
        break
      case 'approved':
        approved.push(task)
        break
      case 'done':
        done.push(task)
        break
      case 'failed':
        failed.push(task)
        break
    }
  }

  // Sort done by completion time descending so .slice(0, N) gets most recent
  done.sort((a, b) => {
    const ta = a.completed_at ?? a.updated_at ?? ''
    const tb = b.completed_at ?? b.updated_at ?? ''
    return tb.localeCompare(ta)
  })

  return { backlog, todo, blocked, inProgress, pendingReview, approved, openPrs, done, failed }
}
