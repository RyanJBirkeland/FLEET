import type Database from 'better-sqlite3'

export const version = 24
export const description =
  'Add model, retry_context, failure_reason, max_cost_usd, partial_diff, assigned_reviewer columns'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('model')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN model TEXT DEFAULT NULL')
  }
  if (!cols.includes('retry_context')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN retry_context TEXT DEFAULT NULL')
  }
  if (!cols.includes('failure_reason')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN failure_reason TEXT DEFAULT NULL')
  }
  if (!cols.includes('max_cost_usd')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN max_cost_usd REAL DEFAULT NULL')
  }
  if (!cols.includes('partial_diff')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN partial_diff TEXT DEFAULT NULL')
  }
  if (!cols.includes('assigned_reviewer')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN assigned_reviewer TEXT DEFAULT NULL')
  }
}
