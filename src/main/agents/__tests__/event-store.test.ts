import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../db'

let db: Database.Database

// Mock getDb to use an in-memory database
vi.mock('../../db', async () => {
  const actual = await vi.importActual('../../db') as Record<string, unknown>
  return {
    ...actual,
    getDb: () => db,
  }
})

describe('agent_events migration + event store', () => {
  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  })

  afterEach(() => {
    db.close()
  })

  // ── Migration v11 ──────────────────────────────────────────────────

  it('migration v11 creates agent_events table', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_events'"
    ).get()
    expect(table).toBeDefined()
  })

  it('agent_events has expected columns', () => {
    const columns = db.prepare('PRAGMA table_info(agent_events)').all() as { name: string }[]
    const names = columns.map((c) => c.name)
    expect(names).toContain('id')
    expect(names).toContain('agent_id')
    expect(names).toContain('event_type')
    expect(names).toContain('payload')
    expect(names).toContain('timestamp')
  })

  // ── AgentEventStore ────────────────────────────────────────────────

  describe('AgentEventStore', () => {
    it('appendEvent stores an event and getHistory retrieves it', async () => {
      const { appendEvent, getHistory } = await import('../event-store')

      appendEvent('agent-1', {
        type: 'agent:started',
        model: 'claude-opus-4-6',
        timestamp: Date.now(),
      })
      const history = getHistory('agent-1')

      expect(history).toHaveLength(1)
      expect(history[0].type).toBe('agent:started')
    })

    it('getHistory returns events ordered by timestamp', async () => {
      const { appendEvent, getHistory } = await import('../event-store')

      appendEvent('agent-2', { type: 'agent:started', model: 'opus', timestamp: 100 })
      appendEvent('agent-2', { type: 'agent:text', text: 'hello', timestamp: 200 })
      appendEvent('agent-2', {
        type: 'agent:completed', exitCode: 0, costUsd: 0.5,
        tokensIn: 100, tokensOut: 200, durationMs: 5000, timestamp: 300,
      })

      const history = getHistory('agent-2')
      expect(history).toHaveLength(3)
      expect(history[0].timestamp).toBe(100)
      expect(history[2].timestamp).toBe(300)
    })

    it('getHistory returns empty array for unknown agent', async () => {
      const { getHistory } = await import('../event-store')
      expect(getHistory('nonexistent')).toEqual([])
    })

    it('pruneOldEvents removes events older than retention period', async () => {
      const { appendEvent, getHistory, pruneOldEvents } = await import('../event-store')

      const oldTimestamp = Date.now() - (31 * 24 * 60 * 60 * 1000)
      appendEvent('agent-3', { type: 'agent:started', model: 'opus', timestamp: oldTimestamp })
      appendEvent('agent-3', { type: 'agent:text', text: 'recent', timestamp: Date.now() })

      pruneOldEvents(30)

      const history = getHistory('agent-3')
      expect(history).toHaveLength(1)
      expect(history[0].type).toBe('agent:text')
    })
  })
})
