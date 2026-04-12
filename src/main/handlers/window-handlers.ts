import { BrowserWindow, shell } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { safeHandle, safeOn } from '../ipc-utils'

const ALLOWED_URL_SCHEMES = new Set(['https:', 'http:', 'mailto:'])

export function registerWindowHandlers(): void {
  safeHandle('window:openExternal', (_e, url) => {
    const parsed = new URL(url)
    if (!ALLOWED_URL_SCHEMES.has(parsed.protocol)) {
      throw new Error(`Blocked URL scheme: "${parsed.protocol}"`)
    }
    return shell.openExternal(url)
  })

  safeOn('window:setTitle', (_e, title: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (win && typeof title === 'string') win.setTitle(title)
  })

  safeHandle('playground:openInBrowser', async (_e, html: string) => {
    const timestamp = Date.now()
    const filename = `bde-playground-${timestamp}.html`
    const filepath = join(tmpdir(), filename)
    writeFileSync(filepath, html, 'utf-8')
    await shell.openPath(filepath)
    return filepath
  })
}
