import { SplitSquareVertical } from 'lucide-react'

interface TerminalToolbarProps {
  activeTabKind: 'shell' | 'agent'
  splitEnabled: boolean
  onClear: () => void
  onToggleSplit: () => void
}

export function TerminalToolbar({
  activeTabKind,
  splitEnabled,
  onClear,
  onToggleSplit
}: TerminalToolbarProps): React.JSX.Element {
  const isAgentTab = activeTabKind === 'agent'
  return (
    <div className="terminal-toolbar">
      {!isAgentTab && (
        <button
          className="terminal-toolbar__btn"
          onClick={onClear}
          title="Clear terminal"
          aria-label="Clear terminal"
        >
          <span className="terminal-toolbar__kbd">⌃L</span>
        </button>
      )}

      <button
        className={`terminal-toolbar__btn terminal-toolbar__btn--icon${splitEnabled ? ' terminal-toolbar__btn--active' : ''}`}
        onClick={onToggleSplit}
        title={splitEnabled ? 'Close split (⌘⇧D)' : 'Split pane (⌘⇧D)'}
        aria-label={splitEnabled ? 'Close split' : 'Split pane'}
      >
        <SplitSquareVertical size={14} />
      </button>
    </div>
  )
}
