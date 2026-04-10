import type Database from 'better-sqlite3'

export const version = 23
export const description = 'Add next_eligible_at for retry backoff'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('next_eligible_at')) {
    db.exec('ALTER TABLE sprint_tasks ADD COLUMN next_eligible_at TEXT')
  }
}
