import { describe, it, expect } from 'vitest'
import { getPendingMigrations } from '../loader'
import type { Migration } from '../loader'

function makeMigration(version: number): Migration {
  return {
    version,
    description: `migration v${version}`,
    up: () => {}
  }
}

describe('getPendingMigrations', () => {
  it('returns empty array when no migrations are pending', () => {
    const migrations = [makeMigration(1), makeMigration(2)]
    expect(getPendingMigrations(migrations, 2)).toEqual([])
  })

  it('returns all migrations when currentVersion is 0', () => {
    const migrations = [makeMigration(1), makeMigration(2), makeMigration(3)]
    const pending = getPendingMigrations(migrations, 0)
    expect(pending.map((m) => m.version)).toEqual([1, 2, 3])
  })

  it('returns only migrations above currentVersion', () => {
    const migrations = [makeMigration(1), makeMigration(2), makeMigration(3)]
    const pending = getPendingMigrations(migrations, 1)
    expect(pending.map((m) => m.version)).toEqual([2, 3])
  })

  it('returns a single pending migration without error', () => {
    const migrations = [makeMigration(1), makeMigration(2)]
    const pending = getPendingMigrations(migrations, 1)
    expect(pending).toHaveLength(1)
    expect(pending[0].version).toBe(2)
  })

  it('throws when pending migrations have a version gap', () => {
    const migrations = [makeMigration(1), makeMigration(3)] // v2 is missing
    expect(() => getPendingMigrations(migrations, 0)).toThrow(/gap|Missing/i)
  })

  it('includes the missing version number in the error message', () => {
    const migrations = [makeMigration(1), makeMigration(3)]
    expect(() => getPendingMigrations(migrations, 0)).toThrow('Missing v2')
  })

  it('throws on a gap in the middle of a longer pending sequence', () => {
    const migrations = [
      makeMigration(1),
      makeMigration(2),
      makeMigration(3),
      makeMigration(5) // v4 missing
    ]
    expect(() => getPendingMigrations(migrations, 2)).toThrow('Missing v4')
  })

  it('does not throw when applied migrations have gaps — only pending matters', () => {
    // v2 is "missing" but already applied (currentVersion = 3), so pending is just v5
    const migrations = [makeMigration(1), makeMigration(3), makeMigration(5)]
    // pending = [v5], single item — no gap check fires
    expect(() => getPendingMigrations(migrations, 3)).not.toThrow()
  })

  it('sorts pending migrations by version before gap checking', () => {
    // Provide migrations out of order to ensure sort happens before check
    const migrations = [makeMigration(3), makeMigration(1), makeMigration(2)]
    const pending = getPendingMigrations(migrations, 0)
    expect(pending.map((m) => m.version)).toEqual([1, 2, 3])
  })
})
