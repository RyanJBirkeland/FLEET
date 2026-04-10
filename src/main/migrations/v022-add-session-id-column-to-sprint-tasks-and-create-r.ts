import type Database from 'better-sqlite3'

export const version = 22
export const description = 'Add session_id column to sprint_tasks and create review_comments table'

export const up: (db: Database.Database) => void = (db) => {
  // Add session_id column if missing
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('session_id')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN session_id TEXT')
  }

  // Create review_comments table
  db.exec(`
        CREATE TABLE IF NOT EXISTS review_comments (
          id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          task_id         TEXT NOT NULL,
          file_path       TEXT,
          line_number     INTEGER,
          body            TEXT NOT NULL,
          author          TEXT NOT NULL DEFAULT 'user',
          revision_number INTEGER NOT NULL DEFAULT 1,
          created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        CREATE INDEX IF NOT EXISTS idx_review_comments_task_id ON review_comments(task_id);
      `)
}
