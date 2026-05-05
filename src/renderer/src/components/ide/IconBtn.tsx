import { useState } from 'react'
import type { ReactNode } from 'react'

interface IconBtnProps {
  icon: ReactNode
  title: string
  active?: boolean
  onClick: () => void
  disabled?: boolean
}

export function IconBtn({
  icon,
  title,
  active = false,
  onClick,
  disabled = false
}: IconBtnProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)

  const backgroundColor = active
    ? 'var(--accent-soft)'
    : hovered
      ? 'var(--surf-2)'
      : 'transparent'

  const color = active ? 'var(--accent)' : hovered ? 'var(--fg-2)' : 'var(--fg-3)'

  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--r-sm)',
        border: 'none',
        backgroundColor,
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        padding: 0,
        flexShrink: 0,
        transition: `background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)`,
        outline: 'none'
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid var(--accent-line)'
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none'
        e.currentTarget.style.outlineOffset = '0'
      }}
    >
      {icon}
    </button>
  )
}
