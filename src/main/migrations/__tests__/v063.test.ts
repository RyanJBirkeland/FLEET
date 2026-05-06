import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { up, version } from '../v063-ensure-is-paused-on-task-groups'

function makeDbWithoutColumn(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE task_groups (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      depends_on TEXT DEFAULT NULL
    )
  `)
  return db
}

function makeDbWithColumn(): Database.Database {
  const db = makeDbWithoutColumn()
  db.exec('ALTER TABLE task_groups ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0')
  return db
}

describe('migration v063', () => {
  it('has version 63', () => {
    expect(version).toBe(63)
  })

  it('adds is_paused on a DB where v056 never ran', () => {
    const db = makeDbWithoutColumn()
    up(db)
    const cols = (db.pragma('table_info(task_groups)') as Array<{ name: string }>).map((c) => c.name)
    expect(cols).toContain('is_paused')
    db.close()
  })

  it('is a no-op on a DB where is_paused already exists', () => {
    const db = makeDbWithColumn()
    expect(() => up(db)).not.toThrow()
    const cols = (db.pragma('table_info(task_groups)') as Array<{ name: string }>).map((c) => c.name)
    expect(cols.filter((c) => c === 'is_paused')).toHaveLength(1)
    db.close()
  })
})
