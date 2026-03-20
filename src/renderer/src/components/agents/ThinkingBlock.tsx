import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { tokens } from '../../design-system/tokens'

const THINKING_ACCENT = '#A855F7'
const THINKING_BG = 'rgba(168, 85, 247, 0.15)'

interface ThinkingBlockProps {
  tokenCount: number
  text?: string
  timestamp?: number
}

export function ThinkingBlock({ tokenCount, text }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        border: `1px solid ${THINKING_ACCENT}`,
        borderRadius: tokens.radius.md,
        backgroundColor: THINKING_BG,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.space[2],
          width: '100%',
          padding: `${tokens.space[2]} ${tokens.space[3]}`,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: tokens.font.ui,
          fontSize: tokens.size.sm,
          color: THINKING_ACCENT,
          textAlign: 'left',
        }}
      >
        <ChevronRight
          size={14}
          style={{
            transition: tokens.transition.fast,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>THINKING</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: tokens.size.xs,
            color: tokens.color.textMuted,
            backgroundColor: tokens.color.surfaceHigh,
            padding: `${tokens.space[1]} ${tokens.space[2]}`,
            borderRadius: tokens.radius.full,
            fontFamily: tokens.font.code,
          }}
        >
          {tokenCount.toLocaleString()} tokens
        </span>
      </button>

      {expanded && text && (
        <div
          style={{
            padding: `${tokens.space[2]} ${tokens.space[3]}`,
            borderTop: `1px solid ${THINKING_ACCENT}`,
            fontFamily: tokens.font.code,
            fontSize: tokens.size.sm,
            color: tokens.color.text,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {text}
        </div>
      )}
    </div>
  )
}
