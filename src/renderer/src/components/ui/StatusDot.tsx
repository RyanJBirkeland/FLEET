export type StatusDotKind = 'running' | 'queued' | 'blocked' | 'review' | 'done' | 'failed'

interface StatusDotProps {
  kind: StatusDotKind
  size?: number
}

const KIND_TO_COLOR: Record<StatusDotKind, string> = {
  running: 'var(--st-running)',
  queued: 'var(--st-queued)',
  blocked: 'var(--st-blocked)',
  review: 'var(--st-review)',
  done: 'var(--st-done)',
  failed: 'var(--st-failed)',
}

/**
 * StatusDot — a small filled circle conveying task status using V2 semantic tokens.
 * Use the `running` kind sparingly; for animated indication prefer `.fleet-pulse`.
 */
export function StatusDot({ kind, size = 6 }: StatusDotProps): React.JSX.Element {
  return (
    <span
      className={`fleet-dot--${kind}`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: KIND_TO_COLOR[kind],
        flexShrink: 0,
      }}
    />
  )
}
