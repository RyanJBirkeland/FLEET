import type Database from 'better-sqlite3'

export const version = 32
export const description = 'Add rebase tracking fields to sprint_tasks'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('rebase_base_sha')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN rebase_base_sha TEXT DEFAULT NULL')
  }
  if (!cols.includes('rebased_at')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN rebased_at TEXT DEFAULT NULL')
  }
}
