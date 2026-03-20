import { EventEmitter } from 'node:events'
import { appendEvent } from './event-store'
import { broadcast } from '../broadcast'
import type { AgentEvent } from './types'

export interface AgentEventBus {
  emit(channel: 'agent:event', agentId: string, event: AgentEvent): void
  on(channel: 'agent:event', handler: (agentId: string, event: AgentEvent) => void): void
  off(channel: 'agent:event', handler: (agentId: string, event: AgentEvent) => void): void
}

export function createEventBus(opts?: { persist?: boolean }): AgentEventBus {
  const emitter = new EventEmitter()
  const persist = opts?.persist ?? true

  return {
    emit(channel, agentId, event) {
      if (persist) {
        appendEvent(agentId, event)
      }
      broadcast('agent:event', { agentId, event })
      emitter.emit(channel, agentId, event)
    },
    on(channel, handler) {
      emitter.on(channel, handler)
    },
    off(channel, handler) {
      emitter.off(channel, handler)
    },
  }
}

// Singleton — created once at app startup
let _bus: AgentEventBus | null = null

export function getEventBus(): AgentEventBus {
  if (!_bus) {
    _bus = createEventBus({ persist: true })
  }
  return _bus
}
