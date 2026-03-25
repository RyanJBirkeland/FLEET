import { useAgentHistoryStore } from '../../stores/agentHistory'
import { useAgentEventsStore } from '../../stores/agentEvents'
import { NEON_ACCENTS } from '../neon/types'
import type { NeonAccent } from '../neon/types'
import { AgentPill } from './AgentPill'

interface LiveActivityStripProps {
  onSelectAgent: (id: string) => void
}

export function LiveActivityStrip({ onSelectAgent }: LiveActivityStripProps): JSX.Element {
  const agents = useAgentHistoryStore((state) => state.agents)
  const events = useAgentEventsStore((state) => state.events)

  const runningAgents = agents.filter((agent) => agent.status === 'running')

  const getLatestAction = (agentId: string): string => {
    const agentEvents = events[agentId]
    if (!agentEvents || agentEvents.length === 0) {
      return ''
    }
    const latestEvent = agentEvents[agentEvents.length - 1]

    switch (latestEvent.type) {
      case 'agent:tool_call':
        return latestEvent.summary || `Calling ${latestEvent.tool}`
      case 'agent:thinking':
        return 'Thinking...'
      case 'agent:text':
        return latestEvent.text.slice(0, 50)
      case 'agent:user_message':
        return 'Processing user message'
      case 'agent:rate_limited':
        return `Rate limited (retry in ${Math.round(latestEvent.retryDelayMs / 1000)}s)`
      case 'agent:error':
        return `Error: ${latestEvent.message.slice(0, 30)}`
      case 'agent:completed':
        return 'Completed'
      case 'agent:started':
        return `Started with ${latestEvent.model}`
      case 'agent:tool_result':
        return latestEvent.success ? `${latestEvent.tool} succeeded` : `${latestEvent.tool} failed`
      case 'agent:playground':
        return `Generated ${latestEvent.filename}`
      default:
        return ''
    }
  }

  const getAccent = (index: number): NeonAccent => {
    return NEON_ACCENTS[index % NEON_ACCENTS.length]
  }

  if (runningAgents.length === 0) {
    return (
      <div className="live-strip">
        <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px' }}>
          No agents active
        </span>
        <button
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'var(--neon-purple-surface)',
            border: '1px solid var(--neon-purple-border)',
            color: 'var(--neon-purple)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onClick={() => {
            // TODO: implement spawn agent dialog
            console.log('Spawn agent clicked')
          }}
        >
          Spawn Agent
        </button>
      </div>
    )
  }

  return (
    <div className="live-strip">
      {runningAgents.map((agent, index) => (
        <AgentPill
          key={agent.id}
          agent={agent}
          currentAction={getLatestAction(agent.id)}
          accent={getAccent(index)}
          onClick={() => onSelectAgent(agent.id)}
        />
      ))}
    </div>
  )
}
