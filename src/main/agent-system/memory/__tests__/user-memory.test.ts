import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock settings before importing the module under test
vi.mock('../../../settings', () => ({
  getSettingJson: vi.fn(),
  setSettingJson: vi.fn()
}))

// Mock paths to use a temp directory
vi.mock('../../../paths', () => ({
  BDE_MEMORY_DIR: '/tmp/bde-test-memory'
}))

// Mock fs — we control existsSync and readFileSync
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn()
  }
})

import { getUserMemory } from '../user-memory'
import { getSettingJson, setSettingJson } from '../../../settings'
import { existsSync, readFileSync } from 'fs'

const mockGetSettingJson = vi.mocked(getSettingJson)
const mockSetSettingJson = vi.mocked(setSettingJson)
const mockExistsSync = vi.mocked(existsSync)
const mockReadFileSync = vi.mocked(readFileSync)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getUserMemory', () => {
  it('returns empty when no active files setting exists', () => {
    mockGetSettingJson.mockReturnValue(null)

    const result = getUserMemory()

    expect(result).toEqual({ content: '', totalBytes: 0, fileCount: 0 })
    expect(mockGetSettingJson).toHaveBeenCalledWith('memory.activeFiles')
  })

  it('returns empty when active files map is empty', () => {
    mockGetSettingJson.mockReturnValue({})

    const result = getUserMemory()

    expect(result).toEqual({ content: '', totalBytes: 0, fileCount: 0 })
  })

  it('reads correct files when active', () => {
    mockGetSettingJson.mockReturnValue({
      'project-notes.md': true,
      'conventions.md': true
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation((path) => {
      if (String(path).includes('project-notes.md')) return 'Project notes content'
      if (String(path).includes('conventions.md')) return 'Conventions content'
      return ''
    })

    const result = getUserMemory()

    expect(result.fileCount).toBe(2)
    expect(result.content).toContain('### project-notes.md')
    expect(result.content).toContain('Project notes content')
    expect(result.content).toContain('### conventions.md')
    expect(result.content).toContain('Conventions content')
    expect(result.content).toContain('---')
  })

  it('skips inactive files (active=false)', () => {
    mockGetSettingJson.mockReturnValue({
      'active.md': true,
      'inactive.md': false
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('Active content')

    const result = getUserMemory()

    expect(result.fileCount).toBe(1)
    expect(result.content).toContain('### active.md')
    expect(result.content).not.toContain('inactive.md')
  })

  it('handles missing files and prunes stale keys', () => {
    mockGetSettingJson.mockReturnValue({
      'exists.md': true,
      'missing.md': true
    })
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('exists.md')
    })
    mockReadFileSync.mockReturnValue('Existing file content')

    const result = getUserMemory()

    expect(result.fileCount).toBe(1)
    expect(result.content).toContain('### exists.md')
    // Should have written pruned map back
    expect(mockSetSettingJson).toHaveBeenCalledWith('memory.activeFiles', {
      'exists.md': true
    })
  })

  it('does not write back if no files were pruned', () => {
    mockGetSettingJson.mockReturnValue({
      'file.md': true
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('Content')

    getUserMemory()

    expect(mockSetSettingJson).not.toHaveBeenCalled()
  })

  it('calculates totalBytes correctly', () => {
    const content1 = 'Hello world' // 11 bytes
    const content2 = 'Test content here' // 17 bytes
    mockGetSettingJson.mockReturnValue({
      'a.md': true,
      'b.md': true
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation((path) => {
      if (String(path).includes('a.md')) return content1
      if (String(path).includes('b.md')) return content2
      return ''
    })

    const result = getUserMemory()

    expect(result.totalBytes).toBe(
      Buffer.byteLength(content1, 'utf-8') + Buffer.byteLength(content2, 'utf-8')
    )
    expect(result.fileCount).toBe(2)
  })

  it('handles readFileSync throwing and prunes the file', () => {
    mockGetSettingJson.mockReturnValue({
      'good.md': true,
      'broken.md': true
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation((path) => {
      if (String(path).includes('broken.md')) throw new Error('Permission denied')
      return 'Good content'
    })

    const result = getUserMemory()

    expect(result.fileCount).toBe(1)
    expect(result.content).toContain('### good.md')
    // Pruned the broken file
    expect(mockSetSettingJson).toHaveBeenCalledWith('memory.activeFiles', {
      'good.md': true
    })
  })
})
