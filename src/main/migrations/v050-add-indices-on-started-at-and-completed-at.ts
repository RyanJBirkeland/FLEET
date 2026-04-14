import type Database from 'better-sqlite3'

export const version = 50
export const description =
  'Add indices on sprint_tasks(started_at) and sprint_tasks(completed_at) to eliminate full table scans in health-check and reporting queries'

export const up: (db: Database.Database) => void = (db) => {
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_sprint_tasks_started_at ON sprint_tasks(started_at ASC)'
  ).run()
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_sprint_tasks_completed_at ON sprint_tasks(completed_at ASC)'
  ).run()
}
