import type Database from 'better-sqlite3'

export const version = 27
export const description = 'Create task_groups table and add group_id to sprint_tasks'

export const up: (db: Database.Database) => void = (db) => {
  // SQLite method, not shell — creates task_groups table
  db.exec(`
        CREATE TABLE IF NOT EXISTS task_groups (
          id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          name         TEXT NOT NULL,
          icon         TEXT DEFAULT 'G',
          accent_color TEXT DEFAULT '#00ffcc',
          goal         TEXT,
          status       TEXT DEFAULT 'draft' CHECK(status IN ('draft','ready','in-pipeline','completed')),
          created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        CREATE TRIGGER IF NOT EXISTS task_groups_updated_at
          AFTER UPDATE ON task_groups
          BEGIN
            UPDATE task_groups SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = NEW.id;
          END;
      `)

  // Add group_id column to sprint_tasks
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('group_id')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN group_id TEXT REFERENCES task_groups(id)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_sprint_tasks_group ON sprint_tasks(group_id)')
  }
}
