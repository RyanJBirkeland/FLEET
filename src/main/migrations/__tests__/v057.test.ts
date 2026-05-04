import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { up, version } from '../v057-add-timestamp-index-on-agent-events'

describe('migration v057', () => {
  it('has version 57', () => {
    expect(version).toBe(57)
  })

  it('creates idx_agent_events_timestamp on agent_events(timestamp DESC)', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE agent_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      timestamp INTEGER NOT NULL
    )`)

    up(db)

    const idx = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='index' AND name='idx_agent_events_timestamp'`
      )
      .get() as { name: string } | undefined

    expect(idx?.name).toBe('idx_agent_events_timestamp')
    db.close()
  })

  it('is idempotent (IF NOT EXISTS)', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE agent_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      timestamp INTEGER NOT NULL
    )`)
    expect(() => {
      up(db)
      up(db)
    }).not.toThrow()
    db.close()
  })
})
