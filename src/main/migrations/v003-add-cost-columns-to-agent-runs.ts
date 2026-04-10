import type Database from 'better-sqlite3'

export const version = 3
export const description = 'Add cost columns to agent_runs'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(agent_runs)') as { name: string }[]).map((c) => c.name)
  for (const [col, type] of [
    ['cost_usd', 'REAL'],
    ['tokens_in', 'INTEGER'],
    ['tokens_out', 'INTEGER'],
    ['cache_read', 'INTEGER'],
    ['cache_create', 'INTEGER'],
    ['duration_ms', 'INTEGER'],
    ['num_turns', 'INTEGER']
  ] as const) {
    if (!cols.includes(col)) {
      db.exec(`ALTER TABLE agent_runs ADD COLUMN ${col} ${type}`)
    }
  }
}
