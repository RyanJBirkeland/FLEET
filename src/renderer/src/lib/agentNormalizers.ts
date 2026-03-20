/**
 * Shared agent normalization utilities — used by both the useUnifiedAgents hook
 * and the useUnifiedAgentsStore Zustand store.
 *
 * Single source of truth for converting raw session/process/history data
 * into UnifiedAgent objects.
 */
import type { UnifiedAgent, UnifiedAgentSource, UnifiedAgentStatus } from '../../../shared/types'
import { SESSION_ACTIVE_THRESHOLD } from './constants'
import type { AgentSession, SubAgent } from '../stores/sessions'
import type { LocalAgentProcess } from '../stores/localAgents'
import type { AgentMeta } from '../../../shared/types'

export function normalizeStatus(raw: string | undefined): UnifiedAgentStatus {
  switch (raw) {
    case 'running':
      return 'running'
    case 'done':
    case 'completed':
      return 'done'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    case 'timeout':
      return 'timeout'
    default:
      return 'unknown'
  }
}

export function normalizeSource(raw: string): UnifiedAgentSource {
  switch (raw) {
    case 'bde':
      return 'local'
    case 'openclaw':
      return 'gateway'
    default:
      return 'history'
  }
}

export function truncateTask(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined
  return s.length > max ? s.slice(0, max) : s
}

export function safeTimestamp(value: string | number | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * Build a unified agent list from the raw data of all four sources.
 */
export function buildUnifiedAgentList(
  sessions: AgentSession[],
  subAgents: SubAgent[],
  processes: LocalAgentProcess[],
  historyAgents: AgentMeta[]
): UnifiedAgent[] {
  const now = Date.now()
  const agents: UnifiedAgent[] = []

  // Gateway sessions (openclaw)
  for (const s of sessions) {
    const isRunning = (s.updatedAt ?? 0) > now - SESSION_ACTIVE_THRESHOLD
    agents.push({
      id: s.key,
      label: s.displayName || s.key,
      source: 'gateway',
      status: isRunning ? 'running' : 'done',
      model: s.model ?? '',
      updatedAt: s.updatedAt ?? 0,
      startedAt: s.updatedAt ?? 0,
      canSteer: true,
      canKill: isRunning,
      isBlocked: s.abortedLastRun === true && !isRunning,
      sessionKey: s.key
    })
  }

  // Sub-agents (gateway)
  for (const a of subAgents) {
    agents.push({
      id: `sub:${a.sessionKey}`,
      label: a.label || a.sessionKey,
      source: 'gateway',
      status: normalizeStatus(a.status),
      model: a.model ?? '',
      updatedAt: a.endedAt ?? a.startedAt ?? 0,
      startedAt: a.startedAt ?? 0,
      canSteer: !!a.isActive,
      canKill: !!a.isActive,
      isBlocked: false,
      task: truncateTask(a.task, 80),
      sessionKey: a.sessionKey
    })
  }

  // Local running processes
  for (const p of processes) {
    const label = p.cwd ? p.cwd.split('/').pop() ?? p.bin : p.bin
    agents.push({
      id: `local:${p.pid}`,
      label,
      source: 'local',
      status: 'running',
      model: '',
      updatedAt: p.startedAt ?? 0,
      startedAt: p.startedAt ?? 0,
      canSteer: false,
      canKill: true,
      isBlocked: false,
      pid: p.pid
    })
  }

  // History agents (all statuses — running ones shown with canKill)
  const localPids = new Set(processes.map((p) => p.pid))
  for (const a of historyAgents) {
    const started = safeTimestamp(a.startedAt)
    const finished = safeTimestamp(a.finishedAt)
    const isRunning = a.status === 'running'
    // Skip if already represented by a live ps-aux process row
    if (isRunning && a.pid && localPids.has(a.pid)) continue
    agents.push({
      id: `history:${a.id}`,
      label: a.repo || a.bin || a.id,
      source: normalizeSource(a.source),
      status: normalizeStatus(a.status),
      model: a.model ?? '',
      updatedAt: finished || started,
      startedAt: started,
      canSteer: false,
      canKill: isRunning && !!a.pid,
      isBlocked: false,
      task: truncateTask(a.task, 80),
      historyId: a.id,
      pid: a.pid ?? undefined
    })
  }

  return agents
}
