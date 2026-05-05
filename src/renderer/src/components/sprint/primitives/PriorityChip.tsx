interface PriorityChipProps {
  priority: number
}

/**
 * PriorityChip — a compact P0–P3 priority badge for V2 task surfaces.
 */
export function PriorityChip({ priority }: PriorityChipProps): React.JSX.Element {
  const isUrgent = priority === 0

  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        fontWeight: 600,
        padding: '1px 4px',
        borderRadius: 'var(--r-sm)',
        background: isUrgent ? 'var(--st-failed)' : 'var(--surf-3)',
        color: isUrgent ? 'white' : 'var(--fg-3)',
        flexShrink: 0,
      }}
    >
      P{priority}
    </span>
  )
}
