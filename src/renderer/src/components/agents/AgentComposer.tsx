import { CommandBar } from './CommandBar'
import type { Attachment } from '../../../../shared/types'

interface AgentComposerProps {
  onSend: (message: string, attachment?: Attachment) => void
  onCommand: (cmd: string, args?: string) => void
  disabled: boolean
  streaming: boolean
  model?: string | undefined
  tokensUsed?: number | undefined
  tokensMax?: number | undefined
}

export function AgentComposer({
  onSend,
  onCommand,
  disabled,
  streaming,
  model,
  tokensUsed,
  tokensMax,
}: AgentComposerProps): React.JSX.Element {
  const isEffectivelyDisabled = disabled || streaming
  const disabledReason = streaming
    ? 'Agent is responding…'
    : disabled
      ? 'Agent not running'
      : undefined

  return (
    <div
      style={{
        padding: 'var(--s-3) var(--s-5)',
        borderTop: '1px solid var(--line)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          background: 'var(--surf-1)',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--s-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-2)',
        }}
      >
        <CommandBar
          onSend={onSend}
          onCommand={onCommand}
          disabled={isEffectivelyDisabled}
          disabledReason={disabledReason}
        />

        {(model !== undefined || tokensUsed !== undefined) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fg-4)',
              }}
            >
              {model}
              {tokensUsed !== undefined
                ? ` · ${Math.round(tokensUsed / 1_000)}k${tokensMax !== undefined ? ` / ${Math.round(tokensMax / 1_000)}k` : ''}`
                : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
