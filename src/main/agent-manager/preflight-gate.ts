import { broadcast } from '../broadcast'
import { createLogger } from '../logger'

const log = createLogger('preflight-gate')
const CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000

export interface PreflightGate {
  requestConfirmation(
    taskId: string,
    missing: string[],
    repoName: string,
    taskTitle: string,
    missingEnvVars?: string[]
  ): Promise<boolean>
  resolveConfirmation(taskId: string, proceed: boolean): void
}

interface PendingEntry {
  resolve: (proceed: boolean) => void
  timer: ReturnType<typeof setTimeout>
}

export function createPreflightGate(): PreflightGate {
  const pending = new Map<string, PendingEntry>()

  return {
    requestConfirmation(taskId, missing, repoName, taskTitle, missingEnvVars = []) {
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          if (pending.has(taskId)) {
            pending.delete(taskId)
            log.warn(`[preflight-gate] confirmation timed out for task ${taskId} — moving to backlog`)
            resolve(false)
          }
        }, CONFIRMATION_TIMEOUT_MS)

        pending.set(taskId, { resolve, timer })
        broadcast('agent:preflightWarning', { taskId, repoName, taskTitle, missing, missingEnvVars })
      })
    },

    resolveConfirmation(taskId, proceed) {
      const entry = pending.get(taskId)
      if (!entry) return
      clearTimeout(entry.timer)
      pending.delete(taskId)
      entry.resolve(proceed)
    }
  }
}
