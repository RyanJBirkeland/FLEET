import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readOrCreateToken, regenerateToken, tokenFilePath } from './token-store'

describe('token-store', () => {
  let dir: string
  let filePath: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'bde-mcp-token-'))
    filePath = join(dir, 'mcp-token')
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('generates a 64-hex-char token when file is absent', async () => {
    const token = await readOrCreateToken(filePath)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const stat = await fs.stat(filePath)
    expect(stat.mode & 0o777).toBe(0o600)
  })

  it('returns existing token on second call', async () => {
    const first = await readOrCreateToken(filePath)
    const second = await readOrCreateToken(filePath)
    expect(second).toBe(first)
  })

  it('regenerateToken overwrites the file with a new value', async () => {
    const first = await readOrCreateToken(filePath)
    const second = await regenerateToken(filePath)
    expect(second).not.toBe(first)
    expect(second).toMatch(/^[0-9a-f]{64}$/)
    const onDisk = (await fs.readFile(filePath, 'utf8')).trim()
    expect(onDisk).toBe(second)
  })

  it('tokenFilePath returns ~/.bde/mcp-token', () => {
    const p = tokenFilePath()
    expect(p.endsWith('/.bde/mcp-token')).toBe(true)
  })
})
