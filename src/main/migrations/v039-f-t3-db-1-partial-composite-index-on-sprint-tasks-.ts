import type Database from 'better-sqlite3'

export const version = 39
export const description =
  'F-t3-db-1: Partial composite index on sprint_tasks(pr_status, pr_number) for listTasksWithOpenPrs (PR poller fires every 60s; was full-scanning)'

export const up: (db: Database.Database) => void = (db) => {
  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_sprint_tasks_pr_open ON sprint_tasks(pr_status, pr_number) WHERE pr_status = 'open'"
  ).run()
}
