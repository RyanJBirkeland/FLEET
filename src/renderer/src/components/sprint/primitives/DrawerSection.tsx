import type { ReactNode } from 'react'

interface DrawerSectionProps {
  eyebrow: string
  title: string
  right?: ReactNode
  children: ReactNode
}

/**
 * DrawerSection — a labeled content section for V2 task detail drawers.
 * Renders an eyebrow label + title header above a flex column of children.
 */
export function DrawerSection({ eyebrow, title, right, children }: DrawerSectionProps): React.JSX.Element {
  return (
    <div
      style={{
        padding: 'var(--s-3) var(--s-4)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-1)' }}>
        <span
          className="fleet-eyebrow"
          style={{ color: 'var(--fg-4)', flex: right ? undefined : 1 }}
        >
          {eyebrow}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--fg-2)',
            flex: 1,
          }}
        >
          {title}
        </span>
        {right}
      </div>
      {children}
    </div>
  )
}
