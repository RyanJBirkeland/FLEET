import type Database from 'better-sqlite3'

export const version = 43
export const description =
  'Add covering index on agent_events(agent_id, timestamp) to optimize agent event queries — hot query path does full table scan with 50K events/day'

export const up: (db: Database.Database) => void = (db) => {
  const sql = `CREATE INDEX IF NOT EXISTS idx_agent_events_agent_id
        ON agent_events (agent_id, timestamp ASC)`
  db.exec(sql)
}
