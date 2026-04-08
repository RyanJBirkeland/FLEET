/**
 * Tests for agent-event-mapper.ts emission order.
 *
 * F-t1-concur-6: Persist to SQLite BEFORE broadcasting to the renderer so that
 * if the write fails, the renderer doesn't have an event the DB doesn't.
 * The broadcast still fires on write failure (logged but non-fatal) so the
 * live tail UX is preserved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const broadcastMock = vi.fn()
const appendEventMock = vi.fn()
const getDbMock = vi.fn(() => ({}) as unknown)

vi.mock('../broadcast', () => ({
  broadcast: (...args: unknown[]) => broadcastMock(...args)
}))

vi.mock('../data/event-queries', () => ({
  appendEvent: (...args: unknown[]) => appendEventMock(...args)
}))

vi.mock('../db', () => ({
  getDb: () => getDbMock()
}))

beforeEach(() => {
  broadcastMock.mockReset()
  appendEventMock.mockReset()
})

describe('emitAgentEvent ordering (F-t1-concur-6)', () => {
  it('persists to SQLite BEFORE broadcasting to renderer', async () => {
    const { emitAgentEvent } = await import('../agent-event-mapper')
    const callOrder: string[] = []
    appendEventMock.mockImplementation(() => {
      callOrder.push('appendEvent')
    })
    broadcastMock.mockImplementation(() => {
      callOrder.push('broadcast')
    })

    emitAgentEvent('agent-1', {
      type: 'agent:text',
      text: 'hello',
      timestamp: 123
    })

    expect(callOrder).toEqual(['appendEvent', 'broadcast'])
  })

  it('still broadcasts when SQLite write fails (live tail UX preserved)', async () => {
    const { emitAgentEvent } = await import('../agent-event-mapper')
    appendEventMock.mockImplementation(() => {
      throw new Error('SQLITE_BUSY')
    })

    expect(() =>
      emitAgentEvent('agent-2', { type: 'agent:text', text: 'hi', timestamp: 1 })
    ).not.toThrow()

    expect(appendEventMock).toHaveBeenCalled()
    expect(broadcastMock).toHaveBeenCalled()
  })
})
