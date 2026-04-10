import type Database from 'better-sqlite3'

export const version = 21
export const description = 'Add worktree_path column to sprint_tasks for review status'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('worktree_path')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN worktree_path TEXT')
  }
}
