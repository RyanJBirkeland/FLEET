import { describe, it, expect } from 'vitest'
import { createPlaygroundDetector } from '../playground-handler'

function assistantToolUse(id: string, name: string, input: Record<string, unknown>): unknown {
  return {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id, name, input }] }
  }
}

function userToolResult(toolUseId: string, isError = false): unknown {
  return {
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: toolUseId, is_error: isError, content: 'ok' }]
    }
  }
}

describe('createPlaygroundDetector', () => {
  it('emits a hit only after tool_result confirms the Write succeeded', () => {
    const detector = createPlaygroundDetector()

    const onUse = detector.onMessage(
      assistantToolUse('toolu_1', 'Write', { file_path: '/tmp/card.html' })
    )
    expect(onUse).toBeNull()

    const onResult = detector.onMessage(userToolResult('toolu_1'))
    expect(onResult).toEqual({ path: '/tmp/card.html', contentType: 'html' })
  })

  it('returns null when tool_result reports an error (no file written)', () => {
    const detector = createPlaygroundDetector()
    detector.onMessage(assistantToolUse('toolu_1', 'Write', { file_path: '/tmp/oops.html' }))

    const onResult = detector.onMessage(userToolResult('toolu_1', true))
    expect(onResult).toBeNull()
  })

  it('ignores non-Write tool uses', () => {
    const detector = createPlaygroundDetector()
    detector.onMessage(assistantToolUse('toolu_1', 'Read', { file_path: '/tmp/card.html' }))
    const onResult = detector.onMessage(userToolResult('toolu_1'))
    expect(onResult).toBeNull()
  })

  it('ignores Writes to files that are not a playground content type', () => {
    const detector = createPlaygroundDetector()
    detector.onMessage(assistantToolUse('toolu_1', 'Write', { file_path: '/tmp/notes.txt' }))
    const onResult = detector.onMessage(userToolResult('toolu_1'))
    expect(onResult).toBeNull()
  })

  it('detects SVG, markdown, and JSON content types', () => {
    const detector = createPlaygroundDetector()

    detector.onMessage(assistantToolUse('u1', 'Write', { file_path: '/tmp/d.svg' }))
    expect(detector.onMessage(userToolResult('u1'))).toEqual({
      path: '/tmp/d.svg',
      contentType: 'svg'
    })

    detector.onMessage(assistantToolUse('u2', 'Write', { file_path: '/tmp/n.md' }))
    expect(detector.onMessage(userToolResult('u2'))).toEqual({
      path: '/tmp/n.md',
      contentType: 'markdown'
    })

    detector.onMessage(assistantToolUse('u3', 'Write', { file_path: '/tmp/d.json' }))
    expect(detector.onMessage(userToolResult('u3'))).toEqual({
      path: '/tmp/d.json',
      contentType: 'json'
    })
  })

  it('pairs multiple interleaved writes correctly', () => {
    const detector = createPlaygroundDetector()

    detector.onMessage(assistantToolUse('a', 'Write', { file_path: '/tmp/a.html' }))
    detector.onMessage(assistantToolUse('b', 'Write', { file_path: '/tmp/b.html' }))

    expect(detector.onMessage(userToolResult('b'))).toEqual({
      path: '/tmp/b.html',
      contentType: 'html'
    })
    expect(detector.onMessage(userToolResult('a'))).toEqual({
      path: '/tmp/a.html',
      contentType: 'html'
    })
  })

  it('still accepts the legacy top-level tool_result shape', () => {
    const detector = createPlaygroundDetector()
    const legacy = {
      type: 'tool_result',
      tool_name: 'Write',
      input: { file_path: '/tmp/legacy.html' }
    }
    expect(detector.onMessage(legacy)).toEqual({
      path: '/tmp/legacy.html',
      contentType: 'html'
    })
  })
})
