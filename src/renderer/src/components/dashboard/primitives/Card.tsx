interface CardProps {
  children: React.ReactNode
  attention?: boolean
  className?: string
}

export function Card({ children, attention = false, className }: CardProps): React.JSX.Element {
  const borderColor = attention
    ? 'color-mix(in oklch, var(--st-failed) 30%, var(--line))'
    : 'var(--line)'
  return (
    <div
      className={className}
      style={{
        background: 'var(--surf-1)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-2)',
        minWidth: 0
      }}
    >
      {children}
    </div>
  )
}
