import type Database from 'better-sqlite3'

export const version = 16
export const description = 'Add spec_type column to sprint_tasks'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('spec_type')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN spec_type TEXT')
  }
}
