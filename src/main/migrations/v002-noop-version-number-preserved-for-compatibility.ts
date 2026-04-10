import type Database from 'better-sqlite3'

export const version = 2
export const description = 'NOOP — version number preserved for compatibility'

export const up: (db: Database.Database) => void = (_db) => {
  // Version number preserved so existing DBs (user_version=2+) are not affected.
}
