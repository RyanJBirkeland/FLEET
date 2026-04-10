import type Database from 'better-sqlite3'

export const version = 31
export const description =
  'Add cross_repo_contract column to sprint_tasks for cross-repo API contracts'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('cross_repo_contract')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN cross_repo_contract TEXT DEFAULT NULL')
  }
}
