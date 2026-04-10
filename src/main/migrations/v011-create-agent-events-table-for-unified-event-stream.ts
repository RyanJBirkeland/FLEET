import type Database from 'better-sqlite3'

export const version = 11
export const description = 'Create agent_events table for unified event streaming'

export const up: (db: Database.Database) => void = (db) => {
  db.exec(`
        CREATE TABLE IF NOT EXISTS agent_events (
          id INTEGER PRIMARY KEY,
          agent_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_events_agent
          ON agent_events(agent_id, timestamp);
      `)
}
