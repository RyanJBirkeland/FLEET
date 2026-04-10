import type Database from 'better-sqlite3'

export const version = 34
export const description = 'Add revision_feedback JSON column to sprint_tasks'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('revision_feedback')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN revision_feedback TEXT DEFAULT NULL')
  }
}
