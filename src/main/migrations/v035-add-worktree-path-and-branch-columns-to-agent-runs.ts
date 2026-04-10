import type Database from 'better-sqlite3'

export const version = 35
export const description =
  'Add worktree_path and branch columns to agent_runs for adhoc worktree tracking'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(agent_runs)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('worktree_path')) {
    db.exec('ALTER TABLE agent_runs ADD COLUMN worktree_path TEXT DEFAULT NULL')
  }
  if (!cols.includes('branch')) {
    db.exec('ALTER TABLE agent_runs ADD COLUMN branch TEXT DEFAULT NULL')
  }
}
