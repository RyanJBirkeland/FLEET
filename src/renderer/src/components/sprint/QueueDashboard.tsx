import { tokens } from '../../design-system/tokens'
import type { QueueHealth } from '../../stores/sprintEvents'
import type { HealthCondition } from '../../../../shared/queue-api-contract'

interface QueueDashboardProps {
  health: QueueHealth | null
}

const conditionColors: Record<HealthCondition, string> = {
  healthy: tokens.color.accent,
  degraded: tokens.color.warning,
  unhealthy: tokens.color.danger,
}

const conditionLabels: Record<HealthCondition, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unhealthy: 'Unhealthy',
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '--'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.round(seconds / 60)}m`
}

function formatRate(rate: number | null): string {
  if (rate === null) return '--'
  return `${Math.round(rate * 100)}%`
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.space[1],
    padding: `${tokens.space[2]} ${tokens.space[4]}`,
    background: tokens.color.surfaceHigh,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.space[3],
    fontFamily: tokens.font.ui,
    fontSize: tokens.size.sm,
    minHeight: '32px',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space[2],
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space[4],
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: tokens.radius.full,
    flexShrink: 0,
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space[1],
    color: tokens.color.textMuted,
  },
  statValue: {
    fontWeight: 600,
    fontFamily: tokens.font.code,
    color: tokens.color.text,
  },
  subtitle: {
    fontSize: tokens.size.xs,
    color: tokens.color.textDim,
    paddingLeft: '16px', // align with text after dot
  },
  nullState: {
    color: tokens.color.textDim,
    fontSize: tokens.size.sm,
    fontStyle: 'italic' as const,
  },
} as const

export function QueueDashboard({ health }: QueueDashboardProps) {
  if (!health) {
    return (
      <div style={styles.container} data-testid="queue-dashboard">
        <span style={styles.nullState}>Queue API inactive</span>
      </div>
    )
  }

  const { queue, doneToday, connectedRunners, recentHealth } = health
  const isConnected = connectedRunners > 0
  const failedCount = (queue.failed ?? 0) + (queue.error ?? 0)

  const condition = recentHealth?.condition ?? (isConnected ? 'healthy' : 'unhealthy')
  const dotColor = isConnected ? conditionColors[condition] : tokens.color.textDim
  const label = isConnected ? conditionLabels[condition] : 'No runner connected'

  return (
    <div style={styles.container} data-testid="queue-dashboard">
      <div style={styles.topRow}>
        <div style={styles.left}>
          <span
            style={{ ...styles.dot, backgroundColor: dotColor }}
            data-testid="runner-dot"
          />
          <span style={{ color: isConnected ? tokens.color.text : tokens.color.textMuted }}>
            {label}
          </span>
        </div>

        <div style={styles.right}>
          <span style={styles.stat}>
            Queued <span style={styles.statValue}>{queue.queued ?? 0}</span>
          </span>
          <span style={styles.stat}>
            Active <span style={styles.statValue}>{queue.active ?? 0}</span>
          </span>
          <span style={styles.stat}>
            Done today <span style={styles.statValue}>{doneToday}</span>
          </span>
          <span style={styles.stat}>
            Failed{' '}
            <span
              style={{
                ...styles.statValue,
                color: failedCount > 0 ? tokens.color.danger : tokens.color.text,
              }}
              data-testid="failed-count"
            >
              {failedCount}
            </span>
          </span>
        </div>
      </div>

      {recentHealth && isConnected && (
        <div style={styles.subtitle}>
          {formatRate(recentHealth.successRate)} success · {formatDuration(recentHealth.avgDurationMs)} avg · {recentHealth.rateLimits} rate limits (1h)
        </div>
      )}
    </div>
  )
}
