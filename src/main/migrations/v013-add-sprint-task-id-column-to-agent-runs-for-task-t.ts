import type Database from 'better-sqlite3'

export const version = 13
export const description = 'Add sprint_task_id column to agent_runs for task-to-run linking'

export const up: (db: Database.Database) => void = (db) => {
  const cols = (db.pragma('table_info(agent_runs)') as { name: string }[]).map((c) => c.name)
  if (!cols.includes('sprint_task_id')) {
    db.exec('ALTER TABLE agent_runs ADD COLUMN sprint_task_id TEXT')
    db.exec('CREATE INDEX IF NOT EXISTS idx_agent_runs_sprint_task ON agent_runs(sprint_task_id)')
  }
}
