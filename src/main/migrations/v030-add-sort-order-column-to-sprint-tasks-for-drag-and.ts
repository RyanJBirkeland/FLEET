import type Database from 'better-sqlite3'

export const version = 30
export const description =
  'Add sort_order column to sprint_tasks for drag-and-drop ordering within groups'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('sort_order')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN sort_order INTEGER DEFAULT 0')
  }
}
