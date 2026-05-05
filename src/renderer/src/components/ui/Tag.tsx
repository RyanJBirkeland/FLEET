import type { ReactNode } from 'react'

interface TagProps {
  children: ReactNode
}

/**
 * Tag — a compact pill for task tags, using V2 surface tokens.
 */
export function Tag({ children }: TagProps): React.JSX.Element {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        padding: '1px 5px',
        borderRadius: 'var(--r-sm)',
        background: 'var(--surf-2)',
        border: '1px solid var(--line)',
        color: 'var(--fg-3)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}
