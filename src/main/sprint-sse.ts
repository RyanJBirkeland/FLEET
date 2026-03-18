import { BrowserWindow } from 'electron'
import { getTaskRunnerConfig } from './config'

const RECONNECT_MS = 3000

let abortController: AbortController | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export function startSprintSseClient(): void {
  connect()
}

export function stopSprintSseClient(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

async function connect(): Promise<void> {
  const config = getTaskRunnerConfig()
  if (!config) {
    console.warn('Task runner not configured — skipping SSE')
    return
  }

  abortController = new AbortController()
  const { signal } = abortController

  try {
    const res = await fetch(config.url + '/events', {
      signal,
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${config.apiKey}`
      }
    })

    if (!res.ok || !res.body) {
      notifyDisconnected()
      scheduleReconnect()
      return
    }

    const decoder = new TextDecoder()
    const reader = res.body.getReader()
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const { parsed, remainder } = parseSSE(buffer)
      buffer = remainder

      for (const event of parsed) {
        notifyRenderer(event)
      }
    }

    notifyDisconnected()
    scheduleReconnect()
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    notifyDisconnected()
    scheduleReconnect()
  }
}

function scheduleReconnect(): void {
  reconnectTimer = setTimeout(connect, RECONNECT_MS)
}

export function parseSSE(buffer: string): {
  parsed: { type: string; data: unknown }[]
  remainder: string
} {
  const parsed: { type: string; data: unknown }[] = []
  const blocks = buffer.split('\n\n')
  const remainder = blocks.pop() ?? ''

  for (const block of blocks) {
    let eventType = 'message'
    let dataLine: string | undefined

    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLine = line.slice(5).trim()
      }
    }

    if (dataLine === undefined) continue

    try {
      parsed.push({ type: eventType, data: JSON.parse(dataLine) })
    } catch {
      // Unparseable events are silently skipped
    }
  }

  return { parsed, remainder }
}

function notifyRenderer(event: { type: string; data: unknown }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('sprint:sse-event', event)
  }
}

/**
 * Tell the renderer that the SSE connection dropped, so it can reset its
 * connected flag and re-subscribe when the connection comes back.
 */
function notifyDisconnected(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('sprint:sse-event', { type: '__sse-disconnected', data: null })
  }
}
