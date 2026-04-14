/**
 * Watchdog loop — agent health checks, idle/timeout/rate-limit verdicts.
 *
 * Extracted from AgentManagerImpl._watchdogLoop so the logic can be
 * unit-tested without spinning up a full manager instance.
 */

import type { Logger } from '../logger'
import type { AgentManagerConfig, ActiveAgent, WatchdogAction } from './types'
import type { MetricsCollector } from './metrics'
import type { ConcurrencyState } from './concurrency'
import type { IAgentTaskRepository } from '../data/sprint-task-repository'
import { checkAgent } from './watchdog'
import { handleWatchdogVerdict } from './watchdog-handler'
import { nowIso } from '../../shared/time'

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

export interface WatchdogLoopDeps {
  config: AgentManagerConfig
  repo: IAgentTaskRepository
  metrics: MetricsCollector
  logger: Logger
  activeAgents: Map<string, ActiveAgent>
  processingTasks: Set<string>
  /** Returns the live ConcurrencyState — called each time to avoid stale captures. */
  getConcurrency: () => ConcurrencyState
  setConcurrency: (state: ConcurrencyState) => void
  onTaskTerminal: (taskId: string, status: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Kill helper
// ---------------------------------------------------------------------------

/**
 * Abort an active agent's handle and send SIGKILL to its subprocess if available,
 * then remove it from the active agents map.
 * SDK may not expose process — revisit when SDK exposes subprocess handle.
 */
export function killActiveAgent(agent: ActiveAgent, activeAgents: Map<string, ActiveAgent>, logger: Logger): void {
  try {
    agent.handle.abort()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = (agent.handle as any).process
    if (proc && typeof proc.kill === 'function') {
      proc.kill('SIGKILL')
    }
  } catch (err) {
    logger.warn(`[agent-manager] Failed to abort agent ${agent.taskId}: ${err}`)
  }
  activeAgents.delete(agent.taskId)
}

// ---------------------------------------------------------------------------
// Main watchdog tick
// ---------------------------------------------------------------------------

/**
 * Execute one watchdog tick: check all active agents, collect the ones that
 * need killing, then process kills (abort handle + status update + terminal
 * notification). Agents currently being processed by the drain loop are
 * skipped to avoid double-transition races.
 */
export function runWatchdog(deps: WatchdogLoopDeps): void {
  const agentsToKill: Array<{ agent: ActiveAgent; verdict: WatchdogAction }> = []

  for (const agent of deps.activeAgents.values()) {
    if (deps.processingTasks.has(agent.taskId)) continue
    const verdict = checkAgent(agent, Date.now(), deps.config)
    if (verdict !== 'ok') {
      agentsToKill.push({ agent, verdict })
    }
  }

  for (const { agent, verdict } of agentsToKill) {
    deps.logger.warn(`[agent-manager] Watchdog killing task ${agent.taskId}: ${verdict}`)
    deps.metrics.recordWatchdogVerdict(verdict)
    if (verdict === 'rate-limit-loop') {
      deps.metrics.increment('retriesQueued')
    }

    killActiveAgent(agent, deps.activeAgents, deps.logger)

    const now = nowIso()
    const maxRuntimeMs = agent.maxRuntimeMs ?? deps.config.maxRuntimeMs
    const result = handleWatchdogVerdict(verdict, deps.getConcurrency(), now, maxRuntimeMs)
    deps.setConcurrency(result.concurrency)

    if (result.taskUpdate) {
      try {
        deps.repo.updateTask(agent.taskId, result.taskUpdate)
      } catch (err) {
        deps.logger.warn(
          `[agent-manager] Failed to update task ${agent.taskId} after ${verdict}: ${err}`
        )
      }
    }
    if (result.shouldNotifyTerminal && result.terminalStatus) {
      deps.onTaskTerminal(agent.taskId, result.terminalStatus).catch((err) =>
        deps.logger.warn(
          `[agent-manager] Failed onTerminal for task ${agent.taskId} after ${verdict}: ${err}`
        )
      )
    }
  }
}
