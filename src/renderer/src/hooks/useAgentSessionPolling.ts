import { useEffect } from 'react'
import { useAgentHistoryStore } from '../stores/agentHistory'
import { useBackoffInterval } from './useBackoffInterval'
import { POLL_SESSIONS_INTERVAL } from '../lib/constants'

export function useAgentSessionPolling(): void {
  const fetchAgents = useAgentHistoryStore((s) => s.fetchAgents)

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  useBackoffInterval(fetchAgents, POLL_SESSIONS_INTERVAL)
}
