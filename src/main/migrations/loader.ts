import { readdirSync } from 'fs'
import { join } from 'path'
import type Database from 'better-sqlite3'

export interface Migration {
  version: number
  description: string
  up: (db: Database.Database) => void
}

/**
 * Loads all migration files from the migrations directory.
 * Migration files must be named v###-*.ts where ### is the version number.
 */
export function loadMigrations(): Migration[] {
  const migrationsDir = __dirname
  const files = readdirSync(migrationsDir)
    .filter((f) => f.startsWith('v') && f.endsWith('.ts') && f !== 'loader.ts')
    .sort()

  const migrations: Migration[] = []

  for (const file of files) {
    const modulePath = join(migrationsDir, file)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(modulePath)

    if (typeof mod.version !== 'number') {
      throw new Error(`Migration ${file} missing version export`)
    }
    if (typeof mod.description !== 'string') {
      throw new Error(`Migration ${file} missing description export`)
    }
    if (typeof mod.up !== 'function') {
      throw new Error(`Migration ${file} missing up function export`)
    }

    migrations.push({
      version: mod.version,
      description: mod.description,
      up: mod.up
    })
  }

  // Sort by version to ensure correct order
  migrations.sort((a, b) => a.version - b.version)

  // Validate version sequence
  for (let i = 0; i < migrations.length; i++) {
    const expected = i + 1
    if (migrations[i].version !== expected) {
      throw new Error(
        `Migration version mismatch: expected v${expected}, found v${migrations[i].version}`
      )
    }
  }

  return migrations
}
