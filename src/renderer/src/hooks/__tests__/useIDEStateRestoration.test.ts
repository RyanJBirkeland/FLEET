import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useIDEStateRestoration } from '../useIDEStateRestoration'
import { useIDEStore } from '../../stores/ide'

describe('useIDEStateRestoration — fs.watchDir failure path', () => {
  beforeEach(() => {
    useIDEStore.setState({
      rootPath: '/old/path',
      openTabs: [{ id: 't1', filePath: '/old/path/file.ts', displayName: 'file.ts' }] as any
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('clears rootPath and openTabs when watchDir throws (e.g. path missing on this machine)', async () => {
    const savedState = {
      rootPath: '/missing/path',
      openTabs: [{ filePath: '/missing/path/a.ts' }],
      activeFilePath: '/missing/path/a.ts'
    }
    ;(window.api.settings.getJson as any).mockResolvedValueOnce(savedState)
    ;(window.api.fs.watchDir as any).mockRejectedValueOnce(new Error('ENOENT'))

    renderHook(() => useIDEStateRestoration())

    await waitFor(() => {
      expect(useIDEStore.getState().rootPath).toBe(null)
    })
    expect(useIDEStore.getState().openTabs).toEqual([])
  })
})
