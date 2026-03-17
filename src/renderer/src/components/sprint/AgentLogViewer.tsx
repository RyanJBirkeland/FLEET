import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { renderContent } from '../../lib/markdown'

// ── Types ────────────────────────────────────────────────

export type AgentLogEntry =
  | { kind: 'text'; content: string }
  | { kind: 'tool_use'; name: string; input: Record<string, unknown> }
  | { kind: 'tool_result'; toolName: string; content: string; isError: boolean }
  | { kind: 'system'; content: string }

// ── Parser (pure function, no side effects) ──────────────

export function parseAgentLog(raw: string): AgentLogEntry[] {
  const lines = raw.split('\n')
  const entries: AgentLogEntry[] = []
  let accumulatedText = ''

  const flushText = (): void => {
    if (accumulatedText) {
      entries.push({ kind: 'text', content: accumulatedText })
      accumulatedText = ''
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      continue
    }

    // Unwrap stream_event wrapper
    if (parsed.type === 'stream_event' && parsed.event && typeof parsed.event === 'object') {
      parsed = parsed.event as Record<string, unknown>
    }

    const type = parsed.type as string | undefined

    switch (type) {
      case 'assistant': {
        // Verbose mode: complete assistant turn replaces streamed deltas
        flushText()
        const msg = parsed.message as Record<string, unknown> | undefined
        const blocks = resolveContentBlocks(parsed.content) ?? resolveContentBlocks(msg?.content) ?? []
        for (const block of blocks) {
          if (block.type === 'text' && typeof block.text === 'string' && String(block.text).trim()) {
            entries.push({ kind: 'text', content: String(block.text) })
          } else if (block.type === 'tool_use') {
            entries.push({
              kind: 'tool_use',
              name: String(block.name ?? 'tool'),
              input: toRecord(block.input),
            })
          }
        }
        break
      }

      case 'tool': {
        const blocks = resolveContentBlocks(parsed.content)
        const first = blocks?.[0]
        entries.push({
          kind: 'tool_result',
          toolName: String(parsed.name ?? 'Result'),
          content: first ? JSON.stringify(first) : String(parsed.content ?? ''),
          isError: Boolean(first?.is_error ?? false),
        })
        break
      }

      case 'system': {
        const { type: _type, ...params } = parsed
        entries.push({ kind: 'system', content: JSON.stringify(params) })
        break
      }

      // ── Streaming event support ──────────────────────

      case 'content_block_delta': {
        const delta = parsed.delta as Record<string, unknown> | undefined
        if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
          accumulatedText += delta.text
        }
        break
      }

      case 'content_block_stop':
        flushText()
        break

      case 'content_block_start': {
        const block = parsed.content_block as Record<string, unknown> | undefined
        if (block?.type === 'tool_use') {
          flushText()
          entries.push({
            kind: 'tool_use',
            name: String(block.name ?? 'tool'),
            input: toRecord(block.input),
          })
        }
        break
      }

      case 'tool_use':
        flushText()
        entries.push({
          kind: 'tool_use',
          name: String(parsed.name ?? 'tool'),
          input: toRecord(parsed.input),
        })
        break

      case 'tool_result':
        entries.push({
          kind: 'tool_result',
          toolName: String(parsed.name ?? 'Result'),
          content: typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content ?? ''),
          isError: Boolean(parsed.is_error ?? false),
        })
        break

      case 'result': {
        flushText()
        const icon = parsed.subtype === 'success' ? '\u2713' : '\u2717'
        const label = String(parsed.result || (parsed.subtype === 'success' ? 'Done' : 'Failed'))
        const costUsd = typeof parsed.cost_usd === 'number' ? parsed.cost_usd : null
        const cost = costUsd != null ? ` \u00B7 $${costUsd.toFixed(3)}` : ''
        entries.push({ kind: 'system', content: `${icon} ${label}${cost}` })
        break
      }

      default:
        break
    }
  }

  flushText()
  return entries
}

function resolveContentBlocks(content: unknown): Record<string, unknown>[] | null {
  return Array.isArray(content) ? (content as Record<string, unknown>[]) : null
}

function toRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {}
}

// ── Renderer ─────────────────────────────────────────────

const TOOL_RESULT_TRUNCATE = 300

interface AgentLogViewerProps {
  logContent: string
}

export function AgentLogViewer({ logContent }: AgentLogViewerProps): React.JSX.Element {
  const entries = useMemo(() => parseAgentLog(logContent), [logContent])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set())
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set())

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [entries.length])

  const toggleTool = useCallback((idx: number) => {
    setExpandedTools((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }, [])

  const toggleResult = useCallback((idx: number) => {
    setExpandedResults((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }, [])

  if (entries.length === 0) {
    return <div className="agent-log__empty">No parseable log entries.</div>
  }

  return (
    <div className="agent-log" ref={scrollRef}>
      {entries.map((entry, idx) => {
        switch (entry.kind) {
          case 'text':
            return (
              <div key={idx} className="agent-log__bubble agent-log__bubble--text">
                <span className="agent-log__text-content">{renderContent(entry.content)}</span>
              </div>
            )

          case 'tool_use': {
            const expanded = expandedTools.has(idx)
            const inputStr = JSON.stringify(entry.input, null, 2)
            return (
              <div key={idx} className="agent-log__bubble agent-log__bubble--tool">
                <button className="agent-log__tool-header" onClick={() => toggleTool(idx)}>
                  <span className="agent-log__tool-badge">{'\uD83D\uDD27'} {entry.name}</span>
                  <span className="agent-log__tool-arrow">{expanded ? '\u25BE' : '\u25B8'}</span>
                </button>
                <pre className={`agent-log__tool-input${expanded ? '' : ' agent-log__tool-input--collapsed'}`}>
                  {inputStr}
                </pre>
              </div>
            )
          }

          case 'tool_result': {
            const isLong = entry.content.length > TOOL_RESULT_TRUNCATE
            const expanded = expandedResults.has(idx)
            const display = isLong && !expanded
              ? entry.content.slice(0, TOOL_RESULT_TRUNCATE) + '\u2026'
              : entry.content
            return (
              <div
                key={idx}
                className={`agent-log__result${entry.isError ? ' agent-log__result--error' : ''}`}
              >
                <span className="agent-log__result-label">{entry.toolName}</span>
                <pre className="agent-log__result-content">{display}</pre>
                {isLong && (
                  <button className="agent-log__show-more" onClick={() => toggleResult(idx)}>
                    {expanded ? 'show less' : 'show more'}
                  </button>
                )}
              </div>
            )
          }

          case 'system':
            return (
              <div key={idx} className="agent-log__system">
                {entry.content}
              </div>
            )
        }
      })}
    </div>
  )
}
