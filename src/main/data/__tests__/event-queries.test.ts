import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runMigrations } from '../../db'
import { appendEvent, getEventHistory, pruneOldEvents } from '../event-queries'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db)
})

afterEach(() => {
  db.close()
})

describe('appendEvent + getEventHistory', () => {
  it('inserts events and retrieves them in timestamp order', () => {
    const payload1 = JSON.stringify({ type: 'agent:started', model: 'opus', timestamp: 1000 })
    const payload2 = JSON.stringify({ type: 'agent:text', text: 'hello', timestamp: 2000 })

    appendEvent(db, 'agent-1', 'agent:started', payload1, 1000)
    appendEvent(db, 'agent-1', 'agent:text', payload2, 2000)

    const history = getEventHistory(db, 'agent-1')
    expect(history).toHaveLength(2)
    expect(JSON.parse(history[0].payload).type).toBe('agent:started')
    expect(JSON.parse(history[1].payload).type).toBe('agent:text')
  })

  it('returns empty array for unknown agent', () => {
    const history = getEventHistory(db, 'nonexistent')
    expect(history).toEqual([])
  })

  it('keeps events separated by agent ID', () => {
    appendEvent(db, 'agent-1', 'agent:text', '{"type":"agent:text"}', 1000)
    appendEvent(db, 'agent-2', 'agent:text', '{"type":"agent:text"}', 2000)

    expect(getEventHistory(db, 'agent-1')).toHaveLength(1)
    expect(getEventHistory(db, 'agent-2')).toHaveLength(1)
  })
})

describe('pruneOldEvents', () => {
  it('removes events older than retention period', () => {
    const now = Date.now()
    const oldTimestamp = now - 31 * 24 * 60 * 60 * 1000 // 31 days ago
    const recentTimestamp = now - 1 * 24 * 60 * 60 * 1000 // 1 day ago

    appendEvent(db, 'agent-1', 'agent:text', '{"old":true}', oldTimestamp)
    appendEvent(db, 'agent-1', 'agent:text', '{"recent":true}', recentTimestamp)

    pruneOldEvents(db, 30) // keep last 30 days

    const history = getEventHistory(db, 'agent-1')
    expect(history).toHaveLength(1)
    expect(JSON.parse(history[0].payload).recent).toBe(true)
  })

  it('keeps all events when none are old enough', () => {
    const now = Date.now()
    appendEvent(db, 'agent-1', 'agent:text', '{"a":1}', now - 1000)
    appendEvent(db, 'agent-1', 'agent:text', '{"b":2}', now)

    pruneOldEvents(db, 30)

    expect(getEventHistory(db, 'agent-1')).toHaveLength(2)
  })
})
