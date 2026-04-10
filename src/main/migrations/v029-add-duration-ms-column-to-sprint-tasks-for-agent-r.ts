import type Database from 'better-sqlite3'

export const version = 29
export const description = 'Add duration_ms column to sprint_tasks for agent runtime tracking'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('duration_ms')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN duration_ms INTEGER DEFAULT NULL')
  }
}
