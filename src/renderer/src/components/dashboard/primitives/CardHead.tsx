interface CardHeadProps {
  eyebrow: string
  title: string
  right?: React.ReactNode
  eyebrowColor?: string
  live?: boolean
}

export function CardHead({
  eyebrow,
  title,
  right,
  eyebrowColor = 'var(--fg-3)',
  live = false
}: CardHeadProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--s-3)',
        minWidth: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 0
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s-1)' }}>
          {live && <span className="fleet-pulse" style={{ width: 6, height: 6 }} />}
          <span className="fleet-eyebrow" style={{ color: eyebrowColor }}>
            {eyebrow}
          </span>
        </span>
        <span
          style={{
            fontSize: 13,
            color: 'var(--fg)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {title}
        </span>
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}
