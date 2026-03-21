/**
 * Shared agent normalization utilities — used by both the useUnifiedAgents hook
 * and the useUnifiedAgentsStore Zustand store.
 *
 * Single source of truth for converting raw process/history data
 * into UnifiedAgent objects.
 */
import type { UnifiedAgent, UnifiedAgentSource, UnifiedAgentStatus } from '../../../shared/types'
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
 * Build a unified agent list from local processes and history.
 * The sessions/subAgents parameters are kept for API compatibility but
 * are always empty now that the gateway has been removed.
 */
export function buildUnifiedAgentList(
  _sessions: unknown[],
  _subAgents: unknown[],
  processes: LocalAgentProcess[],
  historyAgents: AgentMeta[]
): UnifiedAgent[] {
  const agents: UnifiedAgent[] = []

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
