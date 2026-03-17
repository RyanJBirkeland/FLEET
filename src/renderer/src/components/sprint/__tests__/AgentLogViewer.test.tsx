import { describe, it, expect } from 'vitest'
import { parseAgentLog, type AgentLogEntry } from '../AgentLogViewer'

function line(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
}

describe('parseAgentLog', () => {
  it('returns empty array for empty input', () => {
    expect(parseAgentLog('')).toEqual([])
  })

  it('skips non-JSON lines', () => {
    expect(parseAgentLog('not json\nalso not json')).toEqual([])
  })

  it('parses assistant text from message.content', () => {
    const raw = line({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Hello world' }] },
    })
    const entries = parseAgentLog(raw)
    expect(entries).toEqual([{ kind: 'text', content: 'Hello world' }])
  })

  it('parses assistant text from top-level content', () => {
    const raw = line({
      type: 'assistant',
      content: [{ type: 'text', text: 'Direct content' }],
    })
    const entries = parseAgentLog(raw)
    expect(entries).toEqual([{ kind: 'text', content: 'Direct content' }])
  })

  it('parses assistant tool_use from content blocks', () => {
    const raw = line({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }],
      },
    })
    const entries = parseAgentLog(raw)
    expect(entries).toEqual([
      { kind: 'tool_use', name: 'Bash', input: { command: 'ls' } },
    ])
  })

  it('parses multiple content blocks from one assistant message', () => {
    const raw = line({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Let me check' },
          { type: 'tool_use', name: 'Read', input: { path: '/a.ts' } },
        ],
      },
    })
    const entries = parseAgentLog(raw)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ kind: 'text', content: 'Let me check' })
    expect(entries[1]).toEqual({ kind: 'tool_use', name: 'Read', input: { path: '/a.ts' } })
  })

  it('parses tool type as tool_result', () => {
    const raw = line({
      type: 'tool',
      name: 'Bash',
      content: [{ text: 'output', is_error: false }],
    })
    const entries = parseAgentLog(raw)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('tool_result')
    expect((entries[0] as Extract<AgentLogEntry, { kind: 'tool_result' }>).toolName).toBe('Bash')
    expect((entries[0] as Extract<AgentLogEntry, { kind: 'tool_result' }>).isError).toBe(false)
  })

  it('parses tool with is_error true', () => {
    const raw = line({
      type: 'tool',
      name: 'Bash',
      content: [{ text: 'error', is_error: true }],
    })
    const entries = parseAgentLog(raw)
    expect((entries[0] as Extract<AgentLogEntry, { kind: 'tool_result' }>).isError).toBe(true)
  })

  it('parses system type', () => {
    const raw = line({ type: 'system', prompt: 'You are helpful' })
    const entries = parseAgentLog(raw)
    expect(entries).toEqual([{ kind: 'system', content: '{"prompt":"You are helpful"}' }])
  })

  it('unwraps stream_event wrapper', () => {
    const raw = line({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } },
    })
    // The delta accumulates but doesn't flush without a content_block_stop
    // Add a stop event
    const raw2 = raw + '\n' + line({ type: 'stream_event', event: { type: 'content_block_stop' } })
    const entries = parseAgentLog(raw2)
    expect(entries).toEqual([{ kind: 'text', content: 'hi' }])
  })

  it('accumulates streaming text deltas', () => {
    const lines = [
      line({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } }),
      line({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'world' } }),
      line({ type: 'content_block_stop' }),
    ].join('\n')
    const entries = parseAgentLog(lines)
    expect(entries).toEqual([{ kind: 'text', content: 'Hello world' }])
  })

  it('flushes trailing accumulated text at end of input', () => {
    const raw = line({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'streaming...' } })
    const entries = parseAgentLog(raw)
    expect(entries).toEqual([{ kind: 'text', content: 'streaming...' }])
  })

  it('parses result event as system entry', () => {
    const raw = line({ type: 'result', subtype: 'success', result: 'Task complete', cost_usd: 0.042 })
    const entries = parseAgentLog(raw)
    expect(entries).toEqual([{ kind: 'system', content: '\u2713 Task complete \u00B7 $0.042' }])
  })

  it('parses failed result', () => {
    const raw = line({ type: 'result', subtype: 'error', result: '', cost_usd: 0.01 })
    const entries = parseAgentLog(raw)
    expect(entries[0]).toEqual({ kind: 'system', content: '\u2717 Failed \u00B7 $0.010' })
  })

  it('handles content_block_start for tool_use', () => {
    const lines = [
      line({ type: 'content_block_start', content_block: { type: 'tool_use', name: 'Grep', id: 'x', input: {} } }),
    ].join('\n')
    const entries = parseAgentLog(lines)
    expect(entries).toEqual([{ kind: 'tool_use', name: 'Grep', input: {} }])
  })

  it('handles standalone tool_use event', () => {
    const raw = line({ type: 'tool_use', name: 'Edit', input: { file: 'a.ts' } })
    const entries = parseAgentLog(raw)
    expect(entries).toEqual([{ kind: 'tool_use', name: 'Edit', input: { file: 'a.ts' } }])
  })

  it('handles standalone tool_result event', () => {
    const raw = line({ type: 'tool_result', name: 'Edit', content: 'done', is_error: false })
    const entries = parseAgentLog(raw)
    expect(entries).toEqual([
      { kind: 'tool_result', toolName: 'Edit', content: 'done', isError: false },
    ])
  })

  it('skips empty text blocks in assistant messages', () => {
    const raw = line({
      type: 'assistant',
      message: { content: [{ type: 'text', text: '   ' }] },
    })
    expect(parseAgentLog(raw)).toEqual([])
  })

  it('handles mixed multi-line input', () => {
    const lines = [
      line({ type: 'system', init: true }),
      'not json',
      '',
      line({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }] } }),
      line({ type: 'result', subtype: 'success', result: 'Done', cost_usd: 0.001 }),
    ].join('\n')
    const entries = parseAgentLog(lines)
    expect(entries).toHaveLength(3)
    expect(entries[0].kind).toBe('system')
    expect(entries[1].kind).toBe('text')
    expect(entries[2].kind).toBe('system')
  })
})
