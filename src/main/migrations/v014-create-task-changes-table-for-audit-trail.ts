import type Database from 'better-sqlite3'

export const version = 14
export const description = 'Create task_changes table for audit trail'

export const up: (db: Database.Database) => void = (db) => {
  db.exec(`
        CREATE TABLE IF NOT EXISTS task_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT NOT NULL,
          field TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          changed_by TEXT NOT NULL DEFAULT 'unknown',
          changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE INDEX IF NOT EXISTS idx_task_changes_task_id ON task_changes(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_changes_changed_at ON task_changes(changed_at);
      `)
}
