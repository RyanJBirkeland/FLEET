import { getDb } from '../db'
import type { AgentEvent } from './types'

export function appendEvent(agentId: string, event: AgentEvent): void {
  getDb()
    .prepare(
      'INSERT INTO agent_events (agent_id, event_type, payload, timestamp) VALUES (?, ?, ?, ?)'
    )
    .run(agentId, event.type, JSON.stringify(event), event.timestamp)
}

export function getHistory(agentId: string): AgentEvent[] {
  const rows = getDb()
    .prepare('SELECT payload FROM agent_events WHERE agent_id = ? ORDER BY timestamp ASC')
    .all(agentId) as { payload: string }[]
  return rows.map((r) => JSON.parse(r.payload) as AgentEvent)
}

export function pruneOldEvents(retentionDays: number): void {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  getDb()
    .prepare('DELETE FROM agent_events WHERE timestamp < ?')
    .run(cutoff)
}
