/**
 * Event query functions — extracted from agents/event-store.ts.
 * All functions take `db: Database.Database` as first parameter for testability.
 */
import type Database from 'better-sqlite3'

export function appendEvent(
  db: Database.Database,
  agentId: string,
  eventType: string,
  payload: string,
  timestamp: number
): void {
  db.prepare(
    'INSERT INTO agent_events (agent_id, event_type, payload, timestamp) VALUES (?, ?, ?, ?)'
  ).run(agentId, eventType, payload, timestamp)
}

export function getEventHistory(
  db: Database.Database,
  agentId: string
): { payload: string }[] {
  return db
    .prepare(
      'SELECT payload FROM agent_events WHERE agent_id = ? ORDER BY timestamp ASC'
    )
    .all(agentId) as { payload: string }[]
}

export function pruneOldEvents(
  db: Database.Database,
  retentionDays: number
): void {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  db.prepare('DELETE FROM agent_events WHERE timestamp < ?').run(cutoff)
}
