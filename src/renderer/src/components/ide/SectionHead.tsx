import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface SectionHeadProps {
  eyebrow: string
  open: boolean
  onToggle: () => void
  children?: ReactNode
}

export function SectionHead({
  eyebrow,
  open,
  onToggle,
  children
}: SectionHeadProps): React.JSX.Element {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: 32,
        padding: '0 var(--s-3)',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: '1px solid var(--line)',
        background: 'transparent',
        cursor: 'pointer',
        flexShrink: 0
      }}
    >
      <span className="fleet-eyebrow" style={{ color: 'var(--fg-3)' }}>
        {eyebrow}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {children}
        {open ? (
          <ChevronDown size={14} color="var(--fg-3)" />
        ) : (
          <ChevronRight size={14} color="var(--fg-3)" />
        )}
      </div>
    </button>
  )
}
