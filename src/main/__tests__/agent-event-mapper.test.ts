/**
 * Tests for agent-event-mapper.ts batching and emission.
 *
 * Tests the batched SQLite write behavior — events are queued and flushed
 * either when the batch reaches 50 events or after 100ms timeout.
 * Broadcasts happen immediately for live tail UX.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const broadcastMock = vi.fn()
const insertEventBatchMock = vi.fn()
const getDbMock = vi.fn(() => ({}) as unknown)

vi.mock('../broadcast', () => ({
  broadcast: (...args: unknown[]) => broadcastMock(...args)
}))

vi.mock('../data/event-queries', () => ({
  insertEventBatch: (...args: unknown[]) => insertEventBatchMock(...args)
}))

vi.mock('../db', () => ({
  getDb: () => getDbMock()
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules() // Reset module state between tests
  broadcastMock.mockReset()
  insertEventBatchMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('emitAgentEvent batching', () => {
  it('queues events and broadcasts immediately', async () => {
    const { emitAgentEvent } = await import('../agent-event-mapper')

    emitAgentEvent('agent-1', { type: 'agent:text', text: 'hello', timestamp: 123 })

    // Broadcast should fire immediately
    expect(broadcastMock).toHaveBeenCalledTimes(1)
    expect(broadcastMock).toHaveBeenCalledWith('agent:event', {
      agentId: 'agent-1',
      event: { type: 'agent:text', text: 'hello', timestamp: 123 }
    })

    // SQLite write should NOT happen immediately (batched)
    expect(insertEventBatchMock).not.toHaveBeenCalled()
  })

  it('flushes batch when reaching 50 events', async () => {
    const { emitAgentEvent } = await import('../agent-event-mapper')

    // Emit 49 events — should not flush
    for (let i = 0; i < 49; i++) {
      emitAgentEvent('agent-1', { type: 'agent:text', text: `msg${i}`, timestamp: i })
    }
    expect(insertEventBatchMock).not.toHaveBeenCalled()

    // 50th event should trigger flush
    emitAgentEvent('agent-1', { type: 'agent:text', text: 'msg49', timestamp: 49 })

    expect(insertEventBatchMock).toHaveBeenCalledTimes(1)
    const [_db, batch] = insertEventBatchMock.mock.calls[0]
    expect(batch).toHaveLength(50)
    expect(batch[0].agentId).toBe('agent-1')
    expect(batch[0].eventType).toBe('agent:text')
    expect(JSON.parse(batch[0].payload)).toEqual({ type: 'agent:text', text: 'msg0', timestamp: 0 })
  })

  it('flushes batch after 100ms timeout', async () => {
    const { emitAgentEvent } = await import('../agent-event-mapper')

    // Emit 3 events
    emitAgentEvent('agent-1', { type: 'agent:text', text: 'a', timestamp: 1 })
    emitAgentEvent('agent-1', { type: 'agent:text', text: 'b', timestamp: 2 })
    emitAgentEvent('agent-1', { type: 'agent:text', text: 'c', timestamp: 3 })

    expect(insertEventBatchMock).not.toHaveBeenCalled()

    // Advance timers by 110ms (past the 100ms threshold)
    vi.advanceTimersByTime(110)

    expect(insertEventBatchMock).toHaveBeenCalledTimes(1)
    const [_db, batch] = insertEventBatchMock.mock.calls[0]
    expect(batch).toHaveLength(3)
  })

  it('flushes on explicit flushAgentEventBatcher call (shutdown)', async () => {
    const { emitAgentEvent, flushAgentEventBatcher } = await import('../agent-event-mapper')

    emitAgentEvent('agent-1', { type: 'agent:text', text: 'shutdown test', timestamp: 99 })

    expect(insertEventBatchMock).not.toHaveBeenCalled()

    // Explicit flush (simulating shutdown)
    flushAgentEventBatcher()

    expect(insertEventBatchMock).toHaveBeenCalledTimes(1)
    const [_db, batch] = insertEventBatchMock.mock.calls[0]
    expect(batch).toHaveLength(1)
    expect(batch[0].agentId).toBe('agent-1')
  })

  it('still broadcasts when SQLite batch write fails', async () => {
    const { emitAgentEvent, flushAgentEventBatcher } = await import('../agent-event-mapper')

    insertEventBatchMock.mockImplementation(() => {
      throw new Error('SQLITE_BUSY')
    })

    emitAgentEvent('agent-2', { type: 'agent:text', text: 'hi', timestamp: 1 })

    expect(() => flushAgentEventBatcher()).not.toThrow()

    expect(insertEventBatchMock).toHaveBeenCalled()
    expect(broadcastMock).toHaveBeenCalled()
  })

  it('does not flush when queue is empty', async () => {
    const { flushAgentEventBatcher } = await import('../agent-event-mapper')

    flushAgentEventBatcher()

    expect(insertEventBatchMock).not.toHaveBeenCalled()
  })
})
