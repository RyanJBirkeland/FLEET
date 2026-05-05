import type Database from 'better-sqlite3'

export const version = 59
export const description = 'Add verification_results column to sprint_tasks for gate output capture'

export const up = (db: Database.Database): void => {
  const sql = `ALTER TABLE sprint_tasks ADD COLUMN verification_results TEXT`
  db.exec(sql)
}
