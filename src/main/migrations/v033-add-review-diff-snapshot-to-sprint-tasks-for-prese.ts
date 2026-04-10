import type Database from 'better-sqlite3'

export const version = 33
export const description =
  'Add review_diff_snapshot to sprint_tasks for preserving diffs after worktree cleanup'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('review_diff_snapshot')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN review_diff_snapshot TEXT DEFAULT NULL')
  }
}
