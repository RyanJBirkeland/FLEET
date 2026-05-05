import type { ReactNode } from 'react'

interface EyebrowTitleProps {
  eyebrow: string
  title: string
  right?: ReactNode
}

/**
 * EyebrowTitle — a mono-uppercase label above a section title, with optional trailing slot.
 */
export function EyebrowTitle({ eyebrow, title, right }: EyebrowTitleProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-1)' }}>
      <span className="fleet-eyebrow" style={{ color: 'var(--fg-4)' }}>
        {eyebrow}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-2)', flex: 1 }}>
        {title}
      </span>
      {right}
    </div>
  )
}
