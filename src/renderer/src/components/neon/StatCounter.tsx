import { type NeonAccent, neonVar } from './types'

interface StatCounterProps {
  label: string
  value: number | string
  accent: NeonAccent
  suffix?: string
  trend?: {
    direction: 'up' | 'down'
    label: string
  }
  icon?: React.ReactNode
  onClick?: () => void
}

export function StatCounter({
  label,
  value,
  accent,
  suffix,
  trend,
  icon,
  onClick
}: StatCounterProps): React.JSX.Element {
  const isClickable = !!onClick

  return (
    <div
      className={`stat-counter ${isClickable ? 'stat-counter--clickable' : ''}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      style={{
        background: neonVar(accent, 'surface'),
        border: `1px solid ${neonVar(accent, 'border')}`
      }}
    >
      <div
        data-role="stat-label"
        className="stat-counter__label"
        style={{
          color: neonVar(accent, 'color')
        }}
      >
        {icon}
        {label}
      </div>
      <div className="stat-counter__value-row">
        <span
          className="stat-counter__value"
          style={{
            textShadow: neonVar(accent, 'glow')
          }}
        >
          {value}
        </span>
        {suffix && (
          <span
            className="stat-counter__suffix"
            style={{
              color: neonVar(accent, 'color')
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      {trend && (
        <div className={`stat-counter__trend stat-counter__trend--${trend.direction}`}>
          {trend.direction === 'down' ? '↓' : '↑'} {trend.label}
        </div>
      )}
    </div>
  )
}
