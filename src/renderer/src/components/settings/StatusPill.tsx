/**
 * StatusPill — status indicator badge for settings sections.
 */
import type { ReactNode } from 'react'

export type StatusVariant = 'success' | 'info' | 'warning' | 'neutral' | 'error'

interface StatusPillProps {
  label: string
  variant: StatusVariant
}

export function StatusPill({ label, variant }: StatusPillProps): ReactNode {
  // Map StatusVariant to bde-badge variants
  const badgeVariant = variant === 'neutral' ? 'muted' : variant === 'error' ? 'danger' : variant

  return (
    <span className={`bde-badge bde-badge--md bde-badge--${badgeVariant}`}>
      {variant === 'success' && <span className="bde-badge__dot" aria-hidden="true" />}
      {label}
    </span>
  )
}
