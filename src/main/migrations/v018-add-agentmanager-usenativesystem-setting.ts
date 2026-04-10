import type Database from 'better-sqlite3'

export const version = 18
export const description = 'Add agentManager.useNativeSystem setting'

export const up: (db: Database.Database) => void = (db) => {
  // Add useNativeSystem setting (default false for gradual rollout)
  db.prepare(
    `
        INSERT OR IGNORE INTO settings (key, value)
        VALUES ('agentManager.useNativeSystem', 'false')
      `
  ).run()
}
