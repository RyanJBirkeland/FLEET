import type Database from 'better-sqlite3'

export const version = 45
export const description =
  'Add cache token columns to agent_run_turns for full context window visibility'

export const up: (db: Database.Database) => void = (db) => {
  db.prepare('ALTER TABLE agent_run_turns ADD COLUMN cache_tokens_created INTEGER').run()
  db.prepare('ALTER TABLE agent_run_turns ADD COLUMN cache_tokens_read INTEGER').run()
}
