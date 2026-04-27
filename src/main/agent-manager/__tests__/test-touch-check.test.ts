import { describe, it, expect, vi } from 'vitest'
import { listChangedFiles, detectUntouchedTests } from '../test-touch-check'
import { makeLogger } from './test-helpers'

// ---------------------------------------------------------------------------
// listChangedFiles
// ---------------------------------------------------------------------------

describe('listChangedFiles', () => {
  it('returns empty array when stdout is empty', async () => {
    const execFile = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
    const result = await listChangedFiles('agent/branch', '/repo', {}, { execFile })
    expect(result).toEqual([])
  })

  it('splits stdout on newlines into a path array', async () => {
    const execFile = vi.fn().mockResolvedValue({
      stdout: 'src/a.ts\nsrc/b.ts\nsrc/c.ts\n',
      stderr: ''
    })
    const result = await listChangedFiles('agent/branch', '/repo', {}, { execFile })
    expect(result).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts'])
  })

  it('filters out blank and whitespace-only lines', async () => {
    const execFile = vi.fn().mockResolvedValue({
      stdout: 'src/a.ts\n\n  \nsrc/b.ts\n',
      stderr: ''
    })
    const result = await listChangedFiles('agent/branch', '/repo', {}, { execFile })
    expect(result).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('returns empty array and calls logger.warn when execFile rejects', async () => {
    const execFile = vi.fn().mockRejectedValue(new Error('git failed'))
    const logger = makeLogger()
    const result = await listChangedFiles('agent/branch', '/repo', {}, { execFile, logger })
    expect(result).toEqual([])
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('trims leading and trailing whitespace from each line', async () => {
    const execFile = vi.fn().mockResolvedValue({
      stdout: '  src/a.ts  \n',
      stderr: ''
    })
    const result = await listChangedFiles('agent/branch', '/repo', {}, { execFile })
    expect(result).toEqual(['src/a.ts'])
  })
})

// ---------------------------------------------------------------------------
// detectUntouchedTests
// ---------------------------------------------------------------------------

describe('detectUntouchedTests', () => {
  it('returns empty array when changedFiles is empty', () => {
    const fileExists = vi.fn().mockReturnValue(false)
    expect(detectUntouchedTests([], '/repo', { fileExists })).toEqual([])
  })

  it('returns empty array when no sibling test file exists on disk', () => {
    const fileExists = vi.fn().mockReturnValue(false)
    expect(detectUntouchedTests(['src/foo.ts'], '/repo', { fileExists })).toEqual([])
  })

  it('returns empty array when the sibling test was itself changed', () => {
    const fileExists = vi.fn((path: string) => path.endsWith('foo.test.ts'))
    expect(
      detectUntouchedTests(['src/foo.ts', 'src/foo.test.ts'], '/repo', { fileExists })
    ).toEqual([])
  })

  it('flags a source file whose sibling test exists but was not changed', () => {
    const fileExists = vi.fn((path: string) => path.endsWith('src/foo.test.ts'))
    expect(detectUntouchedTests(['src/foo.ts'], '/repo', { fileExists })).toEqual(['src/foo.ts'])
  })

  it('flags a source file whose test lives in the __tests__ directory', () => {
    const fileExists = vi.fn((path: string) => path.endsWith('src/__tests__/foo.test.ts'))
    expect(detectUntouchedTests(['src/foo.ts'], '/repo', { fileExists })).toEqual(['src/foo.ts'])
  })

  it('does not flag test files themselves as untouched source', () => {
    const fileExists = vi.fn().mockReturnValue(true)
    expect(detectUntouchedTests(['src/foo.test.ts'], '/repo', { fileExists })).toEqual([])
  })

  it('does not flag non-source extensions such as .css', () => {
    const fileExists = vi.fn().mockReturnValue(true)
    expect(detectUntouchedTests(['src/theme.css'], '/repo', { fileExists })).toEqual([])
  })
})
