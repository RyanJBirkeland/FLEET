import { X } from 'lucide-react'

interface ScratchpadBannerProps {
  onDismiss: () => void
}

export function ScratchpadBanner({ onDismiss }: ScratchpadBannerProps): React.JSX.Element {
  return (
    <div
      role="status"
      style={{
        margin: '0 var(--s-2) var(--s-2)',
        padding: 'var(--s-2) var(--s-3)',
        background: 'var(--surf-1)',
        border: '1px solid var(--line)',
        borderLeft: '2px solid var(--accent)',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        gap: 'var(--s-2)',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1 }}>
        <div className="fleet-eyebrow" style={{ marginBottom: 'var(--s-1)' }}>
          SCRATCHPAD
        </div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5 }}>
          Agents here run in isolated worktrees and aren&apos;t tracked in the sprint pipeline.
          Use <em>Promote → Review</em> to flow work into the review queue.
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss scratchpad notice"
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--fg-4)',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}
