import { useCostDataStore } from '../../stores/costData'
import { formatTokens } from '../../lib/format'

export function TokenChip(): React.JSX.Element {
  const totalTokens = useCostDataStore((s) => s.totalTokens)
  const formattedTokens = formatTokens(totalTokens)

  return (
    <div
      className="token-chip"
      style={{
        height: 24,
        padding: '0 var(--s-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-1)',
        background: 'var(--surf-1)',
        border: '1px solid var(--line)',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--t-xs)',
        whiteSpace: 'nowrap',
      }}
      aria-label={`Total session tokens: ${formattedTokens}`}
      data-testid="token-chip"
    >
      <span style={{ color: 'var(--fg-3)' }}>tok</span>
      <span style={{ color: 'var(--fg)' }}>{formattedTokens}</span>
    </div>
  )
}
