interface MiniStatProps {
  label: string
  value: string
}

/**
 * MiniStat — a compact label/value pair for the V2 drawer's Live section grid.
 */
export function MiniStat({ label, value }: MiniStatProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        background: 'var(--surf-2)',
        borderRadius: 'var(--r-sm)',
        padding: 'var(--s-1) var(--s-2)',
      }}
    >
      <span
        className="fleet-eyebrow"
        style={{ color: 'var(--fg-4)', fontSize: 9 }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--fg)',
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  )
}
