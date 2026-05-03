import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: (...args: Parameters<typeof actual.existsSync>) => actual.existsSync(...args),
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) =>
      actual.readFileSync(...(args as [string]))
  }
})

vi.mock('../../lib/async-utils', () => ({
  execFileAsync: vi.fn()
}))

import { detectToolchain, runPreflightChecks } from '../preflight-check'
import { execFileAsync } from '../../lib/async-utils'

function mockFs(present: string[]): void {
  vi.spyOn(fs, 'existsSync').mockImplementation((p) => present.includes(String(p)))
}

describe('detectToolchain', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns empty list for plain npm project', () => {
    mockFs(['/repo/package.json'])
    expect(detectToolchain('/repo')).toEqual([])
  })

  it('detects turbo from turbo.json', () => {
    mockFs(['/repo/turbo.json'])
    const signals = detectToolchain('/repo')
    expect(signals.map((s) => s.binary)).toContain('turbo')
  })

  it('detects turbo from package.json scripts referencing turbo', () => {
    mockFs([])
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ scripts: { typecheck: 'turbo run typecheck' } }) as unknown as Buffer
    )
    const signals = detectToolchain('/repo')
    expect(signals.map((s) => s.binary)).toContain('turbo')
  })

  it('detects pnpm from pnpm-workspace.yaml', () => {
    mockFs(['/repo/pnpm-workspace.yaml'])
    expect(detectToolchain('/repo').map((s) => s.binary)).toContain('pnpm')
  })

  it('detects pnpm from pnpm-lock.yaml', () => {
    mockFs(['/repo/pnpm-lock.yaml'])
    expect(detectToolchain('/repo').map((s) => s.binary)).toContain('pnpm')
  })

  it('detects java and gradlew from gradlew file', () => {
    mockFs(['/repo/gradlew'])
    const binaries = detectToolchain('/repo').map((s) => s.binary)
    expect(binaries).toContain('java')
    expect(binaries).toContain('gradlew')
  })

  it('detects mvn from pom.xml when no gradlew', () => {
    mockFs(['/repo/pom.xml'])
    expect(detectToolchain('/repo').map((s) => s.binary)).toContain('mvn')
  })

  it('detects python and poetry from pyproject.toml', () => {
    mockFs(['/repo/pyproject.toml'])
    const binaries = detectToolchain('/repo').map((s) => s.binary)
    expect(binaries).toContain('python')
    expect(binaries).toContain('poetry')
  })

  it('detects cargo from Cargo.toml', () => {
    mockFs(['/repo/Cargo.toml'])
    expect(detectToolchain('/repo').map((s) => s.binary)).toContain('cargo')
  })

  it('returns empty list (fail-open) when detection throws', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(() => { throw new Error('EACCES') })
    expect(detectToolchain('/repo')).toEqual([])
  })
})

describe('runPreflightChecks', () => {
  const env = { PATH: '/usr/bin' }
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(execFileAsync).mockResolvedValue({ stdout: '/usr/bin/turbo', stderr: '' })
  })

  it('returns ok:true when no toolchain signals detected', async () => {
    mockFs([])
    const result = await runPreflightChecks('/repo', env)
    expect(result).toEqual({ ok: true })
  })

  it('returns ok:true when turbo found in node_modules/.bin', async () => {
    mockFs(['/repo/turbo.json', '/repo/node_modules/.bin/turbo'])
    const result = await runPreflightChecks('/repo', env)
    expect(result).toEqual({ ok: true })
  })

  it('returns ok:false with missing list when binary not found via which', async () => {
    mockFs(['/repo/turbo.json'])
    vi.mocked(execFileAsync).mockRejectedValue(new Error('not found'))
    const result = await runPreflightChecks('/repo', env)
    expect(result).toEqual({ ok: false, missing: ['turbo'], missingEnvVars: [] })
  })

  it('returns ok:true (fail-open) when detection itself throws', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(() => { throw new Error('EACCES') })
    const result = await runPreflightChecks('/repo', env)
    expect(result).toEqual({ ok: true })
  })

  it('probes gradlew via existsSync not which', async () => {
    mockFs(['/repo/gradlew', '/repo/gradlew'])
    vi.mocked(execFileAsync).mockResolvedValue({ stdout: '/usr/bin/java', stderr: '' })
    const result = await runPreflightChecks('/repo', env)
    expect(execFileAsync).not.toHaveBeenCalledWith('which', ['gradlew'], expect.anything())
    expect(result).toEqual({ ok: true })
  })
})
