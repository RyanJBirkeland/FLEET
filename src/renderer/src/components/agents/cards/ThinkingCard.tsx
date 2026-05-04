import './ConsoleCard.css'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

const THINKING_PREVIEW_MAX_CHARS = 120

interface ThinkingCardProps {
  tokenCount: number
  text?: string | undefined
}

export function ThinkingCard({ tokenCount, text }: ThinkingCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const preview = text
    ? text.slice(0, THINKING_PREVIEW_MAX_CHARS) +
      (text.length > THINKING_PREVIEW_MAX_CHARS ? '...' : '')
    : ''

  return (
    <div className="console-card console-card--reasoning" data-testid="console-line-thinking">
      <div className="console-card__header">
        <span aria-hidden="true">💭</span> Reasoning · {tokenCount.toLocaleString()} tokens
        {text && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              color: 'inherit'
            }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight
              size={14}
              style={{
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 100ms ease'
              }}
            />
          </button>
        )}
      </div>
      {text && !expanded && <div className="console-card__preview">{preview}</div>}
      {text && expanded && <div className="console-card__content">{text}</div>}
    </div>
  )
}
