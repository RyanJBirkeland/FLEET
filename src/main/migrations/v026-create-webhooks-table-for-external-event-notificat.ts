import type Database from 'better-sqlite3'

export const version = 26
export const description = 'Create webhooks table for external event notifications'

export const up: (db: Database.Database) => void = (db) => {
  // Create webhooks table using db.exec (SQLite method, not shell exec)
  db.exec(`
        CREATE TABLE IF NOT EXISTS webhooks (
          id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          url        TEXT NOT NULL,
          events     TEXT NOT NULL DEFAULT '[]',
          secret     TEXT,
          enabled    INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        CREATE TRIGGER IF NOT EXISTS webhooks_updated_at
          AFTER UPDATE ON webhooks
          BEGIN
            UPDATE webhooks SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = NEW.id;
          END;
      `)
}
