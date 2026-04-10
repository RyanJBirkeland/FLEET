import type Database from 'better-sqlite3'

export const version = 41
export const description =
  'F-t3-db-7: Composite index on task_changes(task_id, changed_at DESC) eliminates temp B-tree sort on history queries'

export const up: (db: Database.Database) => void = (db) => {
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_task_changes_task_changed ON task_changes(task_id, changed_at DESC)'
  ).run()
}
