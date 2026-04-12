/**
 * Watchdog verdict handling — maps agent health check failures to task
 * status updates and concurrency adjustments.
 *
 * Extracted from index.ts to isolate verdict handling logic and reduce
 * file size.
 */

import type { WatchdogAction } from './types'

/**
 * Result of a watchdog verdict evaluation.
 * Decouples decision-making from execution.
 */
export interface WatchdogVerdictResult {
  taskUpdate: Record<string, unknown> | null
  shouldNotifyTerminal: boolean
  terminalStatus?: string
  shouldRequeue?: boolean
}

/**
 * Handle a watchdog verdict by building a decision object.
 * Returns the verdict result for the caller to apply.
 */
export function handleWatchdogVerdict(
  verdict: WatchdogAction,
  now: string,
  maxRuntimeMs?: number
): WatchdogVerdictResult {
  if (verdict === 'max-runtime') {
    const runtimeMinutes = maxRuntimeMs ? Math.round(maxRuntimeMs / 60000) : 60
    return {
      taskUpdate: {
        status: 'error',
        completed_at: now,
        claimed_by: null,
        notes: `Agent exceeded the maximum runtime of ${runtimeMinutes} minutes. The task may be too large for a single agent session. Consider breaking it into smaller subtasks.`,
        needs_review: true
      },
      shouldNotifyTerminal: true,
      terminalStatus: 'error'
    }
  } else if (verdict === 'idle') {
    return {
      taskUpdate: {
        status: 'error',
        completed_at: now,
        claimed_by: null,
        notes:
          "Agent produced no output for 15 minutes. The agent may be stuck or rate-limited. Check agent events for the last activity. To retry: reset task status to 'queued'.",
        needs_review: true
      },
      shouldNotifyTerminal: true,
      terminalStatus: 'error'
    }
  } else if (verdict === 'rate-limit-loop') {
    return {
      taskUpdate: {
        status: 'queued',
        claimed_by: null,
        notes:
          'Agent hit API rate limits 10+ times and was re-queued with lower concurrency. This usually resolves automatically. If it persists, reduce maxConcurrent in Settings or wait for rate limit cooldown.'
      },
      shouldNotifyTerminal: false,
      shouldRequeue: true
    }
  } else if (verdict === 'cost-budget-exceeded') {
    return {
      taskUpdate: {
        status: 'error',
        completed_at: now,
        claimed_by: null,
        notes:
          'Agent exceeded the cost budget (max_cost_usd). The task consumed more API credits than allowed. Review the task complexity or increase the budget.',
        needs_review: true
      },
      shouldNotifyTerminal: true,
      terminalStatus: 'error'
    }
  }

  // Should never reach here if all WatchdogAction cases are handled
  return {
    taskUpdate: null,
    shouldNotifyTerminal: false
  }
}
