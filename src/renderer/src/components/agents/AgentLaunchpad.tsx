import { LaunchpadGrid } from './LaunchpadGrid'

interface AgentLaunchpadProps {
  onAgentSpawned: () => void
  onCancel?: (() => void) | undefined
}

export function AgentLaunchpad({
  onAgentSpawned,
  onCancel
}: AgentLaunchpadProps): React.JSX.Element {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-7) var(--s-9)' }}>
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-5)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="fleet-eyebrow">SPAWN AGENT</div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 500,
              color: 'var(--fg)',
              letterSpacing: '-0.01em'
            }}
          >
            New scratchpad agent
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5 }}>
            Runs in an isolated worktree. Not tracked in the sprint pipeline until you promote it.
          </p>
        </div>

        <LaunchpadGrid onAgentSpawned={onAgentSpawned} onCancel={onCancel} />
      </div>
    </div>
  )
}
