import { BrowserWindow, ipcMain, shell } from 'electron'
import { safeHandle } from '../ipc-utils'
import { isAgentInteractive } from '../local-agents'

const ALLOWED_URL_SCHEMES = new Set(['https:', 'http:', 'mailto:'])

export function registerWindowHandlers(): void {
  safeHandle('window:openExternal', (_e, url) => {
    const parsed = new URL(url)
    if (!ALLOWED_URL_SCHEMES.has(parsed.protocol)) {
      throw new Error(`Blocked URL scheme: "${parsed.protocol}"`)
    }
    return shell.openExternal(url)
  })

  safeHandle('agent:killLocal', async (_event, pid: number) => {
    if (!isAgentInteractive(pid)) {
      return { ok: false, error: 'PID is not a known agent process' }
    }
    try {
      process.kill(pid, 'SIGTERM')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.on('window:setTitle', (_e, title: string) => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      if (win && typeof title === 'string') win.setTitle(title)
    } catch (err) {
      console.error('[window:setTitle]', err)
    }
  })
}
