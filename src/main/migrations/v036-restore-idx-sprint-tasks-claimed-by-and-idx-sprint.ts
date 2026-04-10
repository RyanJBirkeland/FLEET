import type Database from 'better-sqlite3'

export const version = 36
export const description =
  'Restore idx_sprint_tasks_claimed_by and idx_sprint_tasks_pr_number dropped in v17/v20 table rewrites'

export const up: (db: Database.Database) => void = (db) => {
  db.exec('CREATE INDEX IF NOT EXISTS idx_sprint_tasks_claimed_by ON sprint_tasks(claimed_by)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_sprint_tasks_pr_number ON sprint_tasks(pr_number)')
}
