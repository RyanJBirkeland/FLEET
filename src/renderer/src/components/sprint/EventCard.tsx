/**
 * Renders a single TaskOutputEvent as a structured card in the LogDrawer.
 */
import { useState } from 'react'
import {
  Play,
  Wrench,
  Check,
  X,
  Brain,
  Clock,
  AlertTriangle,
  Flag,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { tokens } from '../../design-system/tokens'
import type {
  TaskOutputEvent,
  AgentStartedEvent,
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentThinkingEvent,
  AgentRateLimitedEvent,
  AgentErrorEvent,
  AgentCompletedEvent,
} from '../../../../shared/queue-api-contract'

type Props = {
  event: TaskOutputEvent
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remSecs = secs % 60
  return `${mins}m ${remSecs}s`
}

function formatCost(usd: number | null): string {
  if (usd === null) return '--'
  return `$${usd.toFixed(4)}`
}

const cardBase: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[1],
  padding: `${tokens.space[2]} ${tokens.space[3]}`,
  borderRadius: tokens.radius.sm,
  fontSize: tokens.size.sm,
  borderLeft: `3px solid ${tokens.color.border}`,
}

function StartedCard({ event }: { event: AgentStartedEvent }) {
  return (
    <div style={{ ...cardBase, borderLeftColor: tokens.color.info }} data-testid="event-card-started">
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2], color: tokens.color.textMuted }}>
        <Play size={14} />
        <span>Agent started</span>
        <span style={{ color: tokens.color.textDim }}>{event.model}</span>
        <span style={{ marginLeft: 'auto', color: tokens.color.textDim, fontSize: tokens.size.xs }}>{formatTime(event.timestamp)}</span>
      </div>
    </div>
  )
}

function ToolCallCard({ event }: { event: AgentToolCallEvent }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ ...cardBase, borderLeftColor: tokens.color.accent }} data-testid="event-card-tool_call">
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }}>
        <Wrench size={14} style={{ color: tokens.color.accent }} />
        <span
          style={{
            background: tokens.color.accentDim,
            color: tokens.color.accent,
            padding: `0 ${tokens.space[1]}`,
            borderRadius: tokens.radius.sm,
            fontSize: tokens.size.xs,
            fontFamily: tokens.font.code,
          }}
        >
          {event.tool}
        </span>
        <span style={{ color: tokens.color.text }}>{event.summary}</span>
        {event.input && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tokens.color.textDim,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label={expanded ? 'Collapse input' : 'Expand input'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <span style={{ marginLeft: event.input ? undefined : 'auto', color: tokens.color.textDim, fontSize: tokens.size.xs }}>{formatTime(event.timestamp)}</span>
      </div>
      {expanded && event.input && (
        <pre
          style={{
            margin: 0,
            padding: tokens.space[2],
            background: tokens.color.surface,
            borderRadius: tokens.radius.sm,
            fontSize: tokens.size.xs,
            fontFamily: tokens.font.code,
            color: tokens.color.textMuted,
            overflow: 'auto',
            maxHeight: '200px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {event.input}
        </pre>
      )}
    </div>
  )
}

function ToolResultCard({ event }: { event: AgentToolResultEvent }) {
  const isSuccess = event.success

  return (
    <div style={{ ...cardBase, borderLeftColor: isSuccess ? tokens.color.success : tokens.color.danger }} data-testid="event-card-tool_result">
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }}>
        {isSuccess ? <Check size={14} style={{ color: tokens.color.success }} /> : <X size={14} style={{ color: tokens.color.danger }} />}
        <span
          style={{
            background: isSuccess ? tokens.color.accentDim : tokens.color.dangerDim,
            color: isSuccess ? tokens.color.success : tokens.color.danger,
            padding: `0 ${tokens.space[1]}`,
            borderRadius: tokens.radius.sm,
            fontSize: tokens.size.xs,
          }}
        >
          {isSuccess ? 'success' : 'failed'}
        </span>
        <span style={{ color: tokens.color.text }}>{event.summary}</span>
        <span style={{ marginLeft: 'auto', color: tokens.color.textDim, fontSize: tokens.size.xs }}>{formatTime(event.timestamp)}</span>
      </div>
    </div>
  )
}

function ThinkingCard({ event }: { event: AgentThinkingEvent }) {
  return (
    <div style={{ ...cardBase, borderLeftColor: tokens.color.info }} data-testid="event-card-thinking">
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2], color: tokens.color.textMuted }}>
        <Brain size={14} />
        <span>{event.tokenCount.toLocaleString()} tokens</span>
        <span style={{ marginLeft: 'auto', color: tokens.color.textDim, fontSize: tokens.size.xs }}>{formatTime(event.timestamp)}</span>
      </div>
    </div>
  )
}

function RateLimitedCard({ event }: { event: AgentRateLimitedEvent }) {
  return (
    <div
      style={{ ...cardBase, borderLeftColor: tokens.color.warning, background: tokens.color.warningDim }}
      data-testid="event-card-rate_limited"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2], color: tokens.color.warning }}>
        <Clock size={14} />
        <span>Rate limited — retrying in {formatDuration(event.retryDelayMs)} (attempt {event.attempt})</span>
      </div>
    </div>
  )
}

function ErrorCard({ event }: { event: AgentErrorEvent }) {
  return (
    <div
      style={{ ...cardBase, borderLeftColor: tokens.color.danger, background: tokens.color.dangerDim }}
      data-testid="event-card-error"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2], color: tokens.color.danger }}>
        <AlertTriangle size={14} />
        <span>{event.message}</span>
      </div>
    </div>
  )
}

function CompletedCard({ event }: { event: AgentCompletedEvent }) {
  const isSuccess = event.exitCode === 0

  return (
    <div
      style={{ ...cardBase, borderLeftColor: isSuccess ? tokens.color.success : tokens.color.danger }}
      data-testid="event-card-completed"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }}>
        <Flag size={14} style={{ color: isSuccess ? tokens.color.success : tokens.color.danger }} />
        <span style={{ color: tokens.color.text, fontWeight: 600 }}>
          Completed (exit {event.exitCode})
        </span>
        <span style={{ marginLeft: 'auto', color: tokens.color.textDim, fontSize: tokens.size.xs }}>{formatTime(event.timestamp)}</span>
      </div>
      <div style={{ display: 'flex', gap: tokens.space[4], color: tokens.color.textMuted, fontSize: tokens.size.xs }}>
        <span>Duration: {formatDuration(event.durationMs)}</span>
        <span>Cost: {formatCost(event.costUsd)}</span>
        {event.tokensIn !== null && <span>In: {event.tokensIn.toLocaleString()}</span>}
        {event.tokensOut !== null && <span>Out: {event.tokensOut.toLocaleString()}</span>}
      </div>
    </div>
  )
}

export function EventCard({ event }: Props): React.JSX.Element {
  switch (event.type) {
    case 'agent:started':
      return <StartedCard event={event as AgentStartedEvent} />
    case 'agent:tool_call':
      return <ToolCallCard event={event as AgentToolCallEvent} />
    case 'agent:tool_result':
      return <ToolResultCard event={event as AgentToolResultEvent} />
    case 'agent:thinking':
      return <ThinkingCard event={event as AgentThinkingEvent} />
    case 'agent:rate_limited':
      return <RateLimitedCard event={event as AgentRateLimitedEvent} />
    case 'agent:error':
      return <ErrorCard event={event as AgentErrorEvent} />
    case 'agent:completed':
      return <CompletedCard event={event as AgentCompletedEvent} />
    default:
      return (
        <div style={cardBase} data-testid="event-card-unknown">
          <span style={{ color: tokens.color.textDim }}>{event.type}</span>
        </div>
      )
  }
}
