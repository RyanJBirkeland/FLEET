import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runMigrations } from '../db'
import { createTask, updateTask } from '../data/sprint-task-crud'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
})

afterEach(() => {
  db.close()
})

async function createTestTask(overrides: Record<string, unknown> = {}): Promise<string> {
  const task = await createTask(
    {
      title: 'Test Task',
      repo: 'fleet',
      spec: '## Overview\nTest spec\n## Files to Change\n- test.ts\n## Implementation Steps\n1. Do it\n## How to Test\nRun tests',
      spec_type: 'feature',
      ...overrides
    },
    db
  )
  if (!task) throw new Error('createTask returned null in test')
  return task.id
}

describe('updateTask — column allowlist enforcement', () => {
  it('persists an allowlisted field update', async () => {
    const id = await createTestTask()

    const result = await updateTask(id, { title: 'Updated Title' }, undefined, db)

    expect(result).not.toBeNull()
    expect(result?.title).toBe('Updated Title')

    const row = db.prepare('SELECT title FROM sprint_tasks WHERE id = ?').get(id) as
      | { title: string }
      | undefined
    expect(row?.title).toBe('Updated Title')
  })

  it('silently ignores non-allowlisted fields', async () => {
    const id = await createTestTask()

    // 'sprint_id' is on SprintTask but not in the write allowlist
    // Any field that maps to a system column not in UPDATE_ALLOWLIST should be ignored.
    // We test with a completely unknown key as well.
    const result = await updateTask(
      id,
      {
        title: 'Still Valid Title',
        completely_unknown_field: 'should be dropped'
      } as Record<string, unknown>,
      undefined,
      db
    )

    expect(result).not.toBeNull()
    expect(result?.title).toBe('Still Valid Title')

    // Confirm the DB has the updated title but no unknown column was created
    const cols = (db.pragma('table_info(sprint_tasks)') as Array<{ name: string }>).map(
      (c) => c.name
    )
    expect(cols).not.toContain('completely_unknown_field')
  })

  it('returns null when patch contains only non-allowlisted fields', async () => {
    const id = await createTestTask()

    const result = await updateTask(
      id,
      { completely_unknown_field: 'ignored' } as Record<string, unknown>,
      undefined,
      db
    )

    // writeTaskUpdate returns null when filterAllowlistedEntries produces an empty list
    expect(result).toBeNull()
  })

  it('throws on an invalid status transition', async () => {
    const id = await createTestTask()

    // Transition backlog → done is not a valid direct path in the state machine.
    // The defense-in-depth guard in writeTaskUpdate should throw.
    await expect(
      updateTask(id, { status: 'done' }, undefined, db)
    ).rejects.toThrow(/Invalid transition|Bypass-prevention/)
  })
})
