import type Database from 'better-sqlite3'

export const version = 48
export const description =
  'Add composite index on agent_runs(status, started_at DESC) to optimize status-filtered queries ordered by recency'

export const up: (db: Database.Database) => void = (db) => {
  const sql = `CREATE INDEX IF NOT EXISTS idx_agent_runs_status_started_at ON agent_runs(status, started_at DESC)`
  db.exec(sql)
}
