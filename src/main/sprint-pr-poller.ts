/**
 * Main-process timer that polls PR statuses for sprint tasks.
 * Runs independently of the renderer — ensures PR merges/closes
 * are detected even when no BDE window is open.
 */
import { parsePrUrl } from '../shared/github'
import type { SprintTask } from '../shared/types'
import type { PrStatusInput, PrStatusResult } from './github-pr-status'

const POLL_INTERVAL_MS = 60_000

export interface SprintPrPollerDeps {
  listTasksWithOpenPrs: () => Promise<SprintTask[]>
  pollPrStatuses: (prs: PrStatusInput[]) => Promise<PrStatusResult[]>
  markTaskDoneByPrNumber: (prNumber: number) => Promise<void>
  markTaskCancelledByPrNumber: (prNumber: number) => Promise<void>
  updateTaskMergeableState: (prNumber: number, state: string | null) => Promise<void>
}

export interface SprintPrPollerInstance {
  start: () => void
  stop: () => void
}

export function createSprintPrPoller(deps: SprintPrPollerDeps): SprintPrPollerInstance {
  let timer: ReturnType<typeof setInterval> | null = null

  async function poll(): Promise<void> {
    const tasks = await deps.listTasksWithOpenPrs()
    if (tasks.length === 0) return

    const inputs: PrStatusInput[] = tasks
      .map((t) => ({ taskId: t.id, prUrl: t.pr_url! }))
      .filter((t) => t.prUrl)

    if (inputs.length === 0) return

    const results = await deps.pollPrStatuses(inputs)

    for (const result of results) {
      const input = inputs.find((i) => i.taskId === result.taskId)
      const prNumber = input ? parsePrUrl(input.prUrl)?.number : undefined
      if (!prNumber) continue

      if (result.merged) {
        await deps.markTaskDoneByPrNumber(prNumber)
      } else if (result.state === 'CLOSED') {
        await deps.markTaskCancelledByPrNumber(prNumber)
      }
      await deps.updateTaskMergeableState(prNumber, result.mergeableState)
    }
  }

  return {
    start() {
      poll()
      timer = setInterval(poll, POLL_INTERVAL_MS)
    },
    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}

// --- Legacy API (backwards compat) ---

import { pollPrStatuses } from './github-pr-status'
import {
  listTasksWithOpenPrs,
  markTaskDoneByPrNumber,
  markTaskCancelledByPrNumber,
  updateTaskMergeableState,
} from './handlers/sprint-local'

let _instance: SprintPrPollerInstance | null = null

export function startSprintPrPoller(): void {
  _instance = createSprintPrPoller({
    listTasksWithOpenPrs,
    pollPrStatuses,
    markTaskDoneByPrNumber,
    markTaskCancelledByPrNumber,
    updateTaskMergeableState,
  })
  _instance.start()
}

export function stopSprintPrPoller(): void {
  _instance?.stop()
  _instance = null
}
