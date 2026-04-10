import type Database from 'better-sqlite3'

export const version = 7
export const description = 'Add claimed_by column to sprint_tasks'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('claimed_by')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN claimed_by TEXT')
  }
}
