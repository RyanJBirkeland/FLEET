import type Database from 'better-sqlite3'

export const version = 19
export const description =
  'Remove agentManager.useNativeSystem setting (native system is now unconditional)'

export const up: (db: Database.Database) => void = (db) => {
  db.prepare("DELETE FROM settings WHERE key = 'agentManager.useNativeSystem'").run()
}
