import type { ActiveAgent, AgentManagerConfig } from './types'
import { RATE_LIMIT_LOOP_THRESHOLD } from './types'

export type WatchdogVerdict = 'ok' | 'idle' | 'max-runtime' | 'rate-limit-loop'

export function checkAgent(agent: ActiveAgent, now: number, config: AgentManagerConfig): WatchdogVerdict {
  if (now - agent.startedAt >= config.maxRuntimeMs) return 'max-runtime'
  if (now - agent.lastOutputAt >= config.idleTimeoutMs) return 'idle'
  if (agent.rateLimitCount >= RATE_LIMIT_LOOP_THRESHOLD) return 'rate-limit-loop'
  return 'ok'
}
