/**
 * AgentCard — compact card showing agent status, task, model, and cost.
 * Used in the AgentList sidebar.
 */
import { Bot, Cpu, Clock } from 'lucide-react'
import type { AgentMeta } from '../../../../shared/types'
import { tokens } from '../../design-system/tokens'

interface AgentCardProps {
  agent: AgentMeta
  selected: boolean
  onClick: () => void
}

const STATUS_COLORS: Record<string, string> = {
  running: tokens.color.success,
  done: tokens.color.textMuted,
  failed: tokens.color.danger,
  cancelled: tokens.color.warning,
  unknown: tokens.color.textDim,
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  const start = new Date(startedAt).getTime()
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now()
  const sec = Math.floor((end - start) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

export function AgentCard({ agent, selected, onClick }: AgentCardProps) {
  const statusColor = STATUS_COLORS[agent.status] ?? tokens.color.textDim
  const isRunning = agent.status === 'running'
  const SourceIcon = agent.source === 'bde' ? Bot : Cpu

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space[1],
        width: '100%',
        padding: `${tokens.space[2]} ${tokens.space[3]}`,
        background: selected ? tokens.color.surfaceHigh : 'transparent',
        border: 'none',
        borderLeft: `2px solid ${selected ? tokens.color.accent : 'transparent'}`,
        cursor: 'pointer',
        textAlign: 'left',
        transition: tokens.transition.fast,
      }}
    >
      {/* Top row: status dot + task title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2] }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: tokens.radius.full,
            background: statusColor,
            flexShrink: 0,
            animation: isRunning ? 'pulse 2s infinite' : undefined,
          }}
        />
        <span
          style={{
            fontSize: tokens.size.md,
            color: tokens.color.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {agent.task.slice(0, 80)}
        </span>
      </div>
      {/* Bottom row: meta info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space[2], paddingLeft: 14 }}>
        <SourceIcon size={10} color={tokens.color.textDim} />
        <span style={{ fontSize: tokens.size.xs, color: tokens.color.textMuted }}>
          {agent.model}
        </span>
        <span style={{ fontSize: tokens.size.xs, color: tokens.color.textMuted }}>·</span>
        <Clock size={10} color={tokens.color.textDim} />
        <span style={{ fontSize: tokens.size.xs, color: tokens.color.textMuted }}>
          {formatDuration(agent.startedAt, agent.finishedAt)}
        </span>
        <span style={{ fontSize: tokens.size.xs, color: tokens.color.textMuted }}>·</span>
        <span style={{ fontSize: tokens.size.xs, color: tokens.color.textMuted }}>
          {agent.repo}
        </span>
      </div>
    </button>
  )
}
