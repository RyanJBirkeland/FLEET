import { getDb } from '../db'
import {
  appendEvent as _appendEvent,
  getEventHistory,
  pruneOldEvents as _pruneOldEvents,
} from '../data/event-queries'
import type { AgentEvent } from './types'

export function appendEvent(agentId: string, event: AgentEvent): void {
  _appendEvent(getDb(), agentId, event.type, JSON.stringify(event), event.timestamp)
}

export function getHistory(agentId: string): AgentEvent[] {
  return getEventHistory(getDb(), agentId).map(
    (r) => JSON.parse(r.payload) as AgentEvent
  )
}

export function pruneOldEvents(retentionDays: number): void {
  _pruneOldEvents(getDb(), retentionDays)
}
