import type Database from 'better-sqlite3'

export const version = 44
export const description = 'Add agent_run_turns table for per-turn token breakdown'

export const up: (db: Database.Database) => void = (db) => {
  const sql = `
        CREATE TABLE IF NOT EXISTS agent_run_turns (
          id          INTEGER PRIMARY KEY,
          run_id      TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
          turn        INTEGER NOT NULL,
          tokens_in   INTEGER,
          tokens_out  INTEGER,
          tool_calls  INTEGER,
          recorded_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_run_turns_run ON agent_run_turns(run_id);
      `
  db.exec(sql)
}
