import type Database from 'better-sqlite3'

export const version = 42
export const description =
  'F-t3-db-6 + F-t3-model-3: Drop unused cost_events table — dark write path, never populated in production after 31K agent events. Phase 0 Q2 confirmed no production writers exist; token/cost data lives in agent_runs columns.'

export const up: (db: Database.Database) => void = (db) => {
  db.prepare('DROP TABLE IF EXISTS cost_events').run()
}
