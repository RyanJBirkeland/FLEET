import type Database from 'better-sqlite3'

export const version = 28
export const description = 'Add sprints table and sprint_id to sprint_tasks'

export const up: (db: Database.Database) => void = (db) => {
  db.exec(`
        CREATE TABLE IF NOT EXISTS sprints (
          id         TEXT PRIMARY KEY
                       DEFAULT (lower(hex(randomblob(16)))),
          name       TEXT NOT NULL,
          goal       TEXT,
          start_date TEXT NOT NULL,
          end_date   TEXT NOT NULL,
          status     TEXT NOT NULL DEFAULT 'planning'
                       CHECK(status IN (
                         'planning','active','completed','cancelled'
                       )),
          created_at TEXT NOT NULL
                       DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at TEXT NOT NULL
                       DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        CREATE TRIGGER IF NOT EXISTS sprints_updated_at
          AFTER UPDATE ON sprints
          BEGIN
            UPDATE sprints SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = NEW.id;
          END;
      `)

  const cols = (
    db.pragma('table_info(sprint_tasks)') as {
      name: string
    }[]
  ).map((c) => c.name)

  if (!cols.includes('sprint_id')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN sprint_id TEXT REFERENCES sprints(id)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_sprint_tasks_sprint ON sprint_tasks(sprint_id)')
  }
}
