import type { ReactNode } from 'react'

type BadgeProps = {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
  size?: 'sm' | 'md'
  children: ReactNode
}

export function Badge({
  variant = 'default',
  size = 'md',
  children,
}: BadgeProps) {
  return (
    <span className={`bde-badge bde-badge--${variant} bde-badge--${size}`}>
      <span className="bde-badge__dot" />
      {children}
    </span>
  )
}
