import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { up, version } from '../v059-add-verification-results-to-sprint-tasks'

describe('migration v059', () => {
  it('has version 59', () => {
    expect(version).toBe(59)
  })

  it('adds verification_results column to sprint_tasks', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE sprint_tasks (id TEXT PRIMARY KEY, title TEXT)`)

    up(db)

    const col = db
      .prepare(
        `SELECT name FROM pragma_table_info('sprint_tasks') WHERE name = 'verification_results'`
      )
      .get() as { name: string } | undefined

    expect(col?.name).toBe('verification_results')
    db.close()
  })

  it('existing rows keep null in the new column', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE sprint_tasks (id TEXT PRIMARY KEY, title TEXT)`)
    db.exec(`INSERT INTO sprint_tasks VALUES ('t1', 'Task 1')`)

    up(db)

    const row = db.prepare(`SELECT verification_results FROM sprint_tasks WHERE id = 't1'`).get() as {
      verification_results: string | null
    }
    expect(row.verification_results).toBeNull()
    db.close()
  })

  it('column accepts valid JSON', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE sprint_tasks (id TEXT PRIMARY KEY, title TEXT)`)
    up(db)

    const json = JSON.stringify({ typecheck: null, tests: null })
    db.exec(`INSERT INTO sprint_tasks (id, title) VALUES ('t2', 'Task 2')`)
    db.prepare(`UPDATE sprint_tasks SET verification_results = ? WHERE id = 't2'`).run(json)

    const row = db.prepare(`SELECT verification_results FROM sprint_tasks WHERE id = 't2'`).get() as {
      verification_results: string
    }
    expect(JSON.parse(row.verification_results)).toEqual({ typecheck: null, tests: null })
    db.close()
  })
})
