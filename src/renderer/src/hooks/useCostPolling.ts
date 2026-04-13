import { useEffect } from 'react'
import { useCostDataStore } from '../stores/costData'
import { useBackoffInterval } from './useBackoffInterval'
import { POLL_COST_INTERVAL } from '../lib/constants'

export function useCostPolling(): void {
  const fetchLocalAgents = useCostDataStore((s) => s.fetchLocalAgents)

  useEffect(() => {
    fetchLocalAgents()
  }, [fetchLocalAgents])

  useBackoffInterval(fetchLocalAgents, POLL_COST_INTERVAL)
}
