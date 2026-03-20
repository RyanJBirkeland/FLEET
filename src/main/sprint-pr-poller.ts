/**
 * Main-process timer that polls PR statuses for sprint tasks.
 * Runs independently of the renderer — ensures PR merges/closes
 * are detected even when no BDE window is open.
 */
import { parsePrUrl } from '../shared/github'
import { pollPrStatuses, type PrStatusInput } from './git'
import {
  listTasksWithOpenPrs,
  markTaskDoneByPrNumber,
  markTaskCancelledByPrNumber,
  updateTaskMergeableState,
} from './handlers/sprint-local'

const POLL_INTERVAL_MS = 60_000

let timer: ReturnType<typeof setInterval> | null = null

async function poll(): Promise<void> {
  const tasks = listTasksWithOpenPrs()
  if (tasks.length === 0) return

  const inputs: PrStatusInput[] = tasks
    .map((t) => ({ taskId: t.id, prUrl: t.pr_url! }))
    .filter((t) => t.prUrl)

  if (inputs.length === 0) return

  const results = await pollPrStatuses(inputs)

  for (const result of results) {
    const input = inputs.find((i) => i.taskId === result.taskId)
    const prNumber = input ? parsePrUrl(input.prUrl)?.number : undefined
    if (!prNumber) continue

    if (result.merged) {
      markTaskDoneByPrNumber(prNumber)
    } else if (result.state === 'CLOSED') {
      markTaskCancelledByPrNumber(prNumber)
    }
    updateTaskMergeableState(prNumber, result.mergeableState)
  }
}

export function startSprintPrPoller(): void {
  poll()
  timer = setInterval(poll, POLL_INTERVAL_MS)
}

export function stopSprintPrPoller(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
