import type Database from 'better-sqlite3'

export const version = 12
export const description = 'Drop sprint_tasks table — tasks now live in Supabase'

export const up: (db: Database.Database) => void = (db) => {
  db.exec(`
        DROP TABLE IF EXISTS sprint_tasks;
        DROP TRIGGER IF EXISTS sprint_tasks_updated_at;
      `)
}
