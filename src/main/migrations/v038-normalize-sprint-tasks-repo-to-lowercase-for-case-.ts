import type Database from 'better-sqlite3'

export const version = 38
export const description = 'Normalize sprint_tasks.repo to lowercase for case-insensitive matching'

export const up: (db: Database.Database) => void = (db) => {
  const stmt = db.prepare('UPDATE sprint_tasks SET repo = lower(repo) WHERE repo <> lower(repo)')
  stmt.run()
}
