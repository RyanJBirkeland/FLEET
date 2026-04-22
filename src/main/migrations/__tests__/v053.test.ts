import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { up, version } from '../v053-add-promoted-to-review-at-to-sprint-tasks'

const CREATE_SPRINT_TASKS = 'CREATE TABLE sprint_tasks (id TEXT PRIMARY KEY, title TEXT)'
const INSERT_TASK = 'INSERT INTO sprint_tasks (id, title) VALUES (?, ?)'
const SELECT_PROMOTED = 'SELECT promoted_to_review_at FROM sprint_tasks WHERE id = ?'
const UPDATE_PROMOTED = 'UPDATE sprint_tasks SET promoted_to_review_at = ? WHERE id = ?'

describe('migration v053', () => {
  it('has version 53', () => {
    expect(version).toBe(53)
  })

  it('adds promoted_to_review_at column; existing rows read back NULL', () => {
    const db = new Database(':memory:')
    db.exec(CREATE_SPRINT_TASKS)
    db.prepare(INSERT_TASK).run('t1', 'existing task')

    up(db)

    const row = db.prepare(SELECT_PROMOTED).get('t1') as
      | { promoted_to_review_at: string | null }
      | undefined

    expect(row).toBeDefined()
    expect(row?.promoted_to_review_at).toBeNull()
    db.close()
  })

  it('stores an ISO8601 timestamp and reads it back unchanged', () => {
    const db = new Database(':memory:')
    db.exec(CREATE_SPRINT_TASKS)
    db.prepare(INSERT_TASK).run('t2', 'review task')

    up(db)

    const iso = '2026-04-22T10:30:45.123Z'
    db.prepare(UPDATE_PROMOTED).run(iso, 't2')

    const row = db.prepare(SELECT_PROMOTED).get('t2') as
      | { promoted_to_review_at: string | null }
      | undefined

    expect(row?.promoted_to_review_at).toBe(iso)
    db.close()
  })
})
