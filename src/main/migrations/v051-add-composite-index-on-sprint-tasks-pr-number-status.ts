import type Database from 'better-sqlite3'

export const version = 51
export const description =
  'Add composite index on sprint_tasks(pr_number, status) to satisfy both predicates in PR poller queries with a single B-tree traversal'

export const up: (db: Database.Database) => void = (db) => {
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_sprint_tasks_pr_number_status ON sprint_tasks(pr_number, status)'
  ).run()
}
