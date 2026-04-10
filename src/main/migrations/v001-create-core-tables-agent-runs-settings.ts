import type Database from 'better-sqlite3'

export const version = 1
export const description = 'Create core tables (agent_runs, settings)'

export const up: (db: Database.Database) => void = (db) => {
  // NOTE: sprint_tasks created in migration v6 (local ownership).
  db.exec(`
        CREATE TABLE IF NOT EXISTS agent_runs (
          id           TEXT PRIMARY KEY,
          pid          INTEGER,
          bin          TEXT NOT NULL DEFAULT 'claude',
          task         TEXT,
          repo         TEXT,
          repo_path    TEXT,
          model        TEXT,
          status       TEXT NOT NULL DEFAULT 'running'
                         CHECK(status IN ('running','done','failed','unknown')),
          log_path     TEXT,
          started_at   TEXT NOT NULL,
          finished_at  TEXT,
          exit_code    INTEGER
        );

        CREATE TABLE IF NOT EXISTS settings (
          key          TEXT PRIMARY KEY,
          value        TEXT NOT NULL,
          updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        CREATE INDEX IF NOT EXISTS idx_agent_runs_pid      ON agent_runs(pid);
        CREATE INDEX IF NOT EXISTS idx_agent_runs_status   ON agent_runs(status);
        CREATE INDEX IF NOT EXISTS idx_agent_runs_finished ON agent_runs(finished_at, started_at DESC);
      `)
}
