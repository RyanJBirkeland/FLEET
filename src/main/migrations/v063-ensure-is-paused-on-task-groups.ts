import type Database from 'better-sqlite3'

export const version = 63
export const description =
  'Self-heal: re-add is_paused to task_groups for DBs where v056 was skipped'

// Some DBs reached user_version >= 56 without `is_paused` ever being added
// (an interim build advanced the version counter without running v056). The
// drain-loop query in getQueuedTasks references tg.is_paused and fails on
// those DBs with "no such column: tg.is_paused", so the migration is replayed
// idempotently here.
export const up = (db: Database.Database): void => {
  const cols = (db.pragma('table_info(task_groups)') as Array<{ name: string }>).map((c) => c.name)
  if (!cols.includes('is_paused')) {
    db.exec('ALTER TABLE task_groups ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0')
  }
}
