import { describe, it, expect } from 'vitest'
import type { AgentEvent } from '../../../../../shared/types'
import { pairEvents } from '../ChatRenderer'

describe('pairEvents', () => {
  it('pairs tool_call with following tool_result of same tool', () => {
    const events: AgentEvent[] = [
      { type: 'agent:tool_call', tool: 'Read', summary: 'src/foo.ts', timestamp: 100 },
      { type: 'agent:tool_result', tool: 'Read', success: true, summary: '50 lines', timestamp: 101 },
    ]
    const blocks = pairEvents(events)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('tool_pair')
  })

  it('leaves unpaired tool_call as standalone', () => {
    const events: AgentEvent[] = [
      { type: 'agent:tool_call', tool: 'Read', summary: 'src/foo.ts', timestamp: 100 },
      { type: 'agent:text', text: 'hello', timestamp: 102 },
    ]
    const blocks = pairEvents(events)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('tool_call')
  })

  it('maps text events to text blocks', () => {
    const events: AgentEvent[] = [
      { type: 'agent:text', text: 'hello', timestamp: 100 },
    ]
    const blocks = pairEvents(events)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
  })

  it('maps user_message events to user_message blocks', () => {
    const events: AgentEvent[] = [
      { type: 'agent:user_message', text: 'do the thing', timestamp: 100 },
    ]
    const blocks = pairEvents(events)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('user_message')
  })

  it('maps thinking events to thinking blocks', () => {
    const events: AgentEvent[] = [
      { type: 'agent:thinking', tokenCount: 150, text: 'Let me think...', timestamp: 100 },
    ]
    const blocks = pairEvents(events)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('thinking')
  })

  it('maps error events to error blocks', () => {
    const events: AgentEvent[] = [
      { type: 'agent:error', message: 'something broke', timestamp: 100 },
    ]
    const blocks = pairEvents(events)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('error')
  })

  it('maps started events to started blocks', () => {
    const events: AgentEvent[] = [
      { type: 'agent:started', model: 'claude-sonnet-4-6', timestamp: 100 },
    ]
    const blocks = pairEvents(events)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('started')
  })

  it('maps completed events to completed blocks', () => {
    const events: AgentEvent[] = [
      { type: 'agent:completed', exitCode: 0, costUsd: 0.1, tokensIn: 100, tokensOut: 50, durationMs: 5000, timestamp: 100 },
    ]
    const blocks = pairEvents(events)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('completed')
  })

  it('handles a full conversation with mixed events', () => {
    const events: AgentEvent[] = [
      { type: 'agent:started', model: 'sonnet', timestamp: 1 },
      { type: 'agent:thinking', tokenCount: 50, timestamp: 2 },
      { type: 'agent:text', text: 'I will read the file', timestamp: 3 },
      { type: 'agent:tool_call', tool: 'Read', summary: 'src/app.ts', timestamp: 4 },
      { type: 'agent:tool_result', tool: 'Read', success: true, summary: '100 lines', timestamp: 5 },
      { type: 'agent:text', text: 'Here is the fix', timestamp: 6 },
      { type: 'agent:tool_call', tool: 'Edit', summary: 'src/app.ts', timestamp: 7 },
      { type: 'agent:tool_result', tool: 'Edit', success: true, summary: 'applied', timestamp: 8 },
      { type: 'agent:completed', exitCode: 0, costUsd: 0.05, tokensIn: 200, tokensOut: 100, durationMs: 10000, timestamp: 9 },
    ]
    const blocks = pairEvents(events)
    expect(blocks).toHaveLength(7)
    expect(blocks.map((b) => b.type)).toEqual([
      'started', 'thinking', 'text', 'tool_pair', 'text', 'tool_pair', 'completed',
    ])
  })

  it('does not pair tool_call with non-matching tool_result', () => {
    const events: AgentEvent[] = [
      { type: 'agent:tool_call', tool: 'Read', summary: 'foo', timestamp: 1 },
      { type: 'agent:tool_result', tool: 'Write', success: true, summary: 'ok', timestamp: 2 },
    ]
    const blocks = pairEvents(events)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('tool_call')
  })

  it('returns empty array for empty events', () => {
    expect(pairEvents([])).toEqual([])
  })
})
