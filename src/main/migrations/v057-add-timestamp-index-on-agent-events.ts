import type Database from 'better-sqlite3'

export const version = 57
export const description = 'Add covering index on agent_events(timestamp DESC) for dashboard queries'

export const up = (db: Database.Database): void => {
  const sql = `CREATE INDEX IF NOT EXISTS idx_agent_events_timestamp ON agent_events(timestamp DESC)`
  db.exec(sql)
}
