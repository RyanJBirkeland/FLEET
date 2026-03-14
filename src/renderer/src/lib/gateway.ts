export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

type StatusListener = (status: ConnectionStatus) => void
type MessageListener = (data: unknown) => void

const MAX_BACKOFF = 30_000
const BASE_BACKOFF = 1_000

export class GatewayClient {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private statusListener: StatusListener
  private messageListeners = new Set<MessageListener>()
  private retryCount = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  constructor(url: string, token: string, onStatus: StatusListener) {
    this.url = url
    this.token = token
    this.statusListener = onStatus
  }

  connect(): void {
    if (this.disposed) return
    this.cleanup()
    this.statusListener('connecting')

    const wsUrl = new URL(this.url)
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'

    this.ws = new WebSocket(wsUrl.toString(), ['openclaw', this.token])

    this.ws.onopen = (): void => {
      this.retryCount = 0
      this.statusListener('connected')
    }

    this.ws.onclose = (): void => {
      if (this.disposed) return
      this.statusListener('disconnected')
      this.scheduleReconnect()
    }

    this.ws.onerror = (): void => {
      if (this.disposed) return
      this.statusListener('error')
    }

    this.ws.onmessage = (event: MessageEvent): void => {
      try {
        const data = JSON.parse(event.data as string)
        for (const listener of this.messageListeners) {
          listener(data)
        }
      } catch {
        // ignore non-JSON messages
      }
    }
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener)
    return () => {
      this.messageListeners.delete(listener)
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed) return
    const delay = Math.min(BASE_BACKOFF * Math.pow(2, this.retryCount), MAX_BACKOFF)
    this.retryCount++
    this.retryTimer = setTimeout(() => this.connect(), delay)
  }

  private cleanup(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.close()
      this.ws = null
    }
  }

  dispose(): void {
    this.disposed = true
    this.cleanup()
    this.messageListeners.clear()
    this.statusListener('disconnected')
  }
}
