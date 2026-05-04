import { useId, useState } from 'react'
import type { ReactNode } from 'react'

type TooltipProps = {
  content: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right' | undefined
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps): React.JSX.Element {
  const tooltipId = useId()
  const [visible, setVisible] = useState(false)

  return (
    <span
      className={`fleet-tooltip fleet-tooltip--${side}`}
      aria-describedby={tooltipId}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className={`fleet-tooltip__content${visible ? ' fleet-tooltip__content--visible' : ''}`}
      >
        {content}
      </span>
    </span>
  )
}
