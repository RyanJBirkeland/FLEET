interface QualityChipProps {
  q: number | null
}

function qualityColor(q: number): string {
  if (q >= 90) return 'var(--st-done)'
  if (q >= 75) return 'var(--st-blocked)'
  return 'var(--st-failed)'
}

export function QualityChip({ q }: QualityChipProps): React.JSX.Element | null {
  if (q == null) return null
  const color = qualityColor(q)
  return (
    <span
      style={{
        height: 18,
        padding: '0 6px',
        display: 'inline-flex',
        alignItems: 'center',
        background: `color-mix(in oklch, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in oklch, ${color} 30%, transparent)`,
        borderRadius: 999,
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color,
        fontWeight: 600,
        flexShrink: 0
      }}
    >
      q{q}
    </span>
  )
}
