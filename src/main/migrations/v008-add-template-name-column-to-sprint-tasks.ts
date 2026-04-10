import type Database from 'better-sqlite3'

export const version = 8
export const description = 'Add template_name column to sprint_tasks'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('template_name')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN template_name TEXT')
  }
}
