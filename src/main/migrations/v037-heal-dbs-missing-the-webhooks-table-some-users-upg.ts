import type Database from 'better-sqlite3'

export const version = 37
export const description =
  'Heal DBs missing the webhooks table (some users upgraded past v26 without the table being created; sprint-listeners then logs SqliteError on every mutation)'

export const up: (db: Database.Database) => void = (db) => {
  // Idempotent re-apply of v26: CREATE TABLE IF NOT EXISTS so correctly
  // migrated DBs are untouched while drifted ones get healed.
  const sql = `
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
      `
  db.exec(sql)
}
