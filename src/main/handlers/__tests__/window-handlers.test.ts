/**
 * Window handler unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'

vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
    openPath: vi.fn().mockResolvedValue('')
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => ({ setTitle: vi.fn() }))
  },
  ipcMain: {
    on: vi.fn()
  }
}))

vi.mock('fs', () => ({
  writeFileSync: vi.fn()
}))

vi.mock('os', () => ({
  tmpdir: vi.fn().mockReturnValue('/tmp')
}))

vi.mock('../../ipc-utils', () => ({
  safeHandle: vi.fn()
}))

import { registerWindowHandlers } from '../window-handlers'
import { safeHandle } from '../../ipc-utils'
import { ipcMain, shell } from 'electron'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'

describe('Window handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers 2 safeHandle channels and 1 ipcMain.on listener', () => {
    registerWindowHandlers()

    expect(safeHandle).toHaveBeenCalledTimes(2)
    expect(safeHandle).toHaveBeenCalledWith('window:openExternal', expect.any(Function))
    expect(safeHandle).toHaveBeenCalledWith('playground:openInBrowser', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('window:setTitle', expect.any(Function))
  })

  describe('handler functions', () => {
    function captureHandlers(): Record<string, any> {
      const safeHandlers: Record<string, any> = {}
      vi.mocked(safeHandle).mockImplementation((channel, handler) => {
        safeHandlers[channel] = handler
      })
      registerWindowHandlers()
      return safeHandlers
    }

    const mockEvent = {} as IpcMainInvokeEvent

    describe('window:openExternal', () => {
      it('opens https URLs', async () => {
        const handlers = captureHandlers()

        await handlers['window:openExternal'](mockEvent, 'https://example.com')

        expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')
      })

      it('opens http URLs', async () => {
        const handlers = captureHandlers()

        await handlers['window:openExternal'](mockEvent, 'http://example.com')

        expect(shell.openExternal).toHaveBeenCalledWith('http://example.com')
      })

      it('opens mailto URLs', async () => {
        const handlers = captureHandlers()

        await handlers['window:openExternal'](mockEvent, 'mailto:test@example.com')

        expect(shell.openExternal).toHaveBeenCalledWith('mailto:test@example.com')
      })

      it('blocks non-allowed URL schemes', () => {
        const handlers = captureHandlers()

        expect(() => handlers['window:openExternal'](mockEvent, 'file:///etc/passwd')).toThrow(
          'Blocked URL scheme: "file:"'
        )

        expect(shell.openExternal).not.toHaveBeenCalled()
      })

      it('blocks javascript: scheme', () => {
        const handlers = captureHandlers()

        expect(() => handlers['window:openExternal'](mockEvent, 'javascript:alert(1)')).toThrow(
          'Blocked URL scheme: "javascript:"'
        )

        expect(shell.openExternal).not.toHaveBeenCalled()
      })
    })

    describe('playground:openInBrowser', () => {
      it('writes HTML to temp file and opens it', async () => {
        vi.mocked(tmpdir).mockReturnValue('/tmp')
        vi.mocked(Date.now).mockReturnValue(1234567890)

        const handlers = captureHandlers()
        const html = '<h1>Test</h1>'

        const result = await handlers['playground:openInBrowser'](mockEvent, html)

        expect(writeFileSync).toHaveBeenCalledWith(
          '/tmp/bde-playground-1234567890.html',
          html,
          'utf-8'
        )
        expect(shell.openPath).toHaveBeenCalledWith('/tmp/bde-playground-1234567890.html')
        expect(result).toBe('/tmp/bde-playground-1234567890.html')
      })
    })
  })
})
