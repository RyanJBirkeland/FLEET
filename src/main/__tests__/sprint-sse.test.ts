import { describe, it, expect } from 'vitest'
import { parseSSE } from '../sprint-sse'

describe('parseSSE', () => {
  it('returns empty parsed array for empty string', () => {
    const result = parseSSE('')
    expect(result.parsed).toEqual([])
    expect(result.remainder).toBe('')
  })

  it('parses a single well-formed event', () => {
    const chunk = 'event: task-update\ndata: {"id":1,"status":"done"}\n\n'
    const result = parseSSE(chunk)
    expect(result.parsed).toEqual([
      { type: 'task-update', data: { id: 1, status: 'done' } }
    ])
    expect(result.remainder).toBe('')
  })

  it('skips events without a data line', () => {
    const chunk = 'event: heartbeat\n\n'
    const result = parseSSE(chunk)
    expect(result.parsed).toEqual([])
  })

  it('skips events with malformed JSON data', () => {
    const chunk = 'event: bad\ndata: {not json\n\n'
    const result = parseSSE(chunk)
    expect(result.parsed).toEqual([])
  })

  it('parses two events in one chunk', () => {
    const chunk =
      'event: a\ndata: {"v":1}\n\nevent: b\ndata: {"v":2}\n\n'
    const result = parseSSE(chunk)
    expect(result.parsed).toHaveLength(2)
    expect(result.parsed[0]).toEqual({ type: 'a', data: { v: 1 } })
    expect(result.parsed[1]).toEqual({ type: 'b', data: { v: 2 } })
  })

  it('returns partial block as remainder', () => {
    const chunk = 'event: done\ndata: {"id":1}\n\nevent: partial\ndata: {"id":'
    const result = parseSSE(chunk)
    expect(result.parsed).toHaveLength(1)
    expect(result.parsed[0]).toEqual({ type: 'done', data: { id: 1 } })
    expect(result.remainder).toBe('event: partial\ndata: {"id":')
  })

  it('defaults to type "message" when no event: line is present', () => {
    const chunk = 'data: {"ping":true}\n\n'
    const result = parseSSE(chunk)
    expect(result.parsed).toEqual([
      { type: 'message', data: { ping: true } }
    ])
  })
})
