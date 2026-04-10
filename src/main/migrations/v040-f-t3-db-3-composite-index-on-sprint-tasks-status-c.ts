import type Database from 'better-sqlite3'

export const version = 40
export const description =
  'F-t3-db-3: Composite index on sprint_tasks(status, claimed_by) for drain-loop and orphan queries'

export const up: (db: Database.Database) => void = (db) => {
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_sprint_tasks_status_claimed ON sprint_tasks(status, claimed_by)'
  ).run()
}
