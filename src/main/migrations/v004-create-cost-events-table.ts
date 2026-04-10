import type Database from 'better-sqlite3'

export const version = 4
export const description = 'Create cost_events table'

export const up: (db: Database.Database) => void = (db) => {
  db.exec(`
        CREATE TABLE IF NOT EXISTS cost_events (
          id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          source        TEXT NOT NULL,
          session_key   TEXT,
          model         TEXT NOT NULL,
          total_tokens  INTEGER NOT NULL DEFAULT 0,
          cost_usd      REAL,
          recorded_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
      `)
}
