import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../db'
import type { AgentEvent } from '../types'

let db: Database.Database

vi.mock('../../db', async () => {
  const actual = await vi.importActual('../../db') as Record<string, unknown>
  return {
    ...actual,
    getDb: () => db,
  }
})

vi.mock('../../broadcast', () => ({
  broadcast: vi.fn(),
}))

import { broadcast } from '../../broadcast'

describe('EventBus', () => {
  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    vi.clearAllMocks()
  })

  afterEach(() => {
    db.close()
  })

  it('emitting an event calls all subscribers', async () => {
    const { createEventBus } = await import('../event-bus')
    const bus = createEventBus({ persist: false })

    const handler = vi.fn()
    bus.on('agent:event', handler)

    const event: AgentEvent = { type: 'agent:started', model: 'opus', timestamp: Date.now() }
    bus.emit('agent:event', 'agent-1', event)

    expect(handler).toHaveBeenCalledWith('agent-1', event)
  })

  it('broadcasts to renderer windows', async () => {
    const { createEventBus } = await import('../event-bus')
    const bus = createEventBus({ persist: false })

    const event: AgentEvent = { type: 'agent:text', text: 'hello', timestamp: Date.now() }
    bus.emit('agent:event', 'agent-1', event)

    expect(broadcast).toHaveBeenCalledWith('agent:event', { agentId: 'agent-1', event })
  })

  it('persists events to event store when persist=true', async () => {
    const { createEventBus } = await import('../event-bus')
    const { getHistory } = await import('../event-store')
    const bus = createEventBus({ persist: true })

    const event: AgentEvent = { type: 'agent:text', text: 'hello', timestamp: Date.now() }
    bus.emit('agent:event', 'agent-persist', event)

    const history = getHistory('agent-persist')
    expect(history).toHaveLength(1)
    expect(history[0].type).toBe('agent:text')
  })

  it('does not persist events when persist=false', async () => {
    const { createEventBus } = await import('../event-bus')
    const { getHistory } = await import('../event-store')
    const bus = createEventBus({ persist: false })

    const event: AgentEvent = { type: 'agent:text', text: 'hello', timestamp: Date.now() }
    bus.emit('agent:event', 'agent-nopersist', event)

    const history = getHistory('agent-nopersist')
    expect(history).toHaveLength(0)
  })

  it('off() removes a subscriber', async () => {
    const { createEventBus } = await import('../event-bus')
    const bus = createEventBus({ persist: false })

    const handler = vi.fn()
    bus.on('agent:event', handler)
    bus.off('agent:event', handler)

    bus.emit('agent:event', 'agent-1', { type: 'agent:text', text: 'hi', timestamp: 1 })
    expect(handler).not.toHaveBeenCalled()
  })
})
