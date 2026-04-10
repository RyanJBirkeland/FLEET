import type Database from 'better-sqlite3'

export const version = 25
export const description = 'Add tags column to sprint_tasks for categorization'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('tags')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN tags TEXT DEFAULT NULL')
  }
}
