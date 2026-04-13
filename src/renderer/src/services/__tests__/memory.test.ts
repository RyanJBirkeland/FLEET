import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listFiles, readFile, writeFile, search, getActiveFiles, setFileActive } from '../memory'

describe('memory service', () => {
  beforeEach(() => {
    // window.api is mocked globally via vitest setup
    vi.mocked(window.api.listMemoryFiles).mockResolvedValue([
      { path: '/mem/note.md', name: 'note.md', size: 128, modifiedAt: 1710000000000, active: true }
    ])
    vi.mocked(window.api.readMemoryFile).mockResolvedValue('# Note content')
    vi.mocked(window.api.writeMemoryFile).mockResolvedValue(undefined)
    vi.mocked(window.api.searchMemory).mockResolvedValue({
      results: [{ path: '/mem/note.md', matches: [{ line: 1, content: '# Note content' }] }],
      timedOut: false
    })
    vi.mocked(window.api.getActiveMemoryFiles).mockResolvedValue({ '/mem/note.md': true })
    vi.mocked(window.api.setMemoryFileActive).mockResolvedValue({ '/mem/note.md': false })
  })

  it('listFiles delegates to window.api.listMemoryFiles', async () => {
    const result = await listFiles()
    expect(window.api.listMemoryFiles).toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('note.md')
  })

  it('readFile delegates to window.api.readMemoryFile', async () => {
    const result = await readFile('/mem/note.md')
    expect(window.api.readMemoryFile).toHaveBeenCalledWith('/mem/note.md')
    expect(result).toBe('# Note content')
  })

  it('writeFile delegates to window.api.writeMemoryFile', async () => {
    await writeFile('/mem/note.md', 'new content')
    expect(window.api.writeMemoryFile).toHaveBeenCalledWith('/mem/note.md', 'new content')
  })

  it('search delegates to window.api.searchMemory', async () => {
    const result = await search('note')
    expect(window.api.searchMemory).toHaveBeenCalledWith('note')
    expect(result.results).toHaveLength(1)
    expect(result.results[0].matches[0].content).toBe('# Note content')
    expect(result.timedOut).toBe(false)
  })

  it('getActiveFiles delegates to window.api.getActiveMemoryFiles', async () => {
    const result = await getActiveFiles()
    expect(window.api.getActiveMemoryFiles).toHaveBeenCalled()
    expect(result).toEqual({ '/mem/note.md': true })
  })

  it('setFileActive delegates to window.api.setMemoryFileActive', async () => {
    const result = await setFileActive('/mem/note.md', false)
    expect(window.api.setMemoryFileActive).toHaveBeenCalledWith('/mem/note.md', false)
    expect(result).toEqual({ '/mem/note.md': false })
  })
})
