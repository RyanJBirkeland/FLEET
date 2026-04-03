import { create } from 'zustand'
import type { AgentCostRecord } from '../../../shared/types'

/**
 * Cost tracking store for agent execution costs and metrics.
 *
 * NOTE: This store queries agent_runs table similarly to agentHistory store,
 * but serves a DIFFERENT purpose. This is intentional separation of concerns:
 * - costData: cost tracking fields (durationMs, numTurns, cache stats) for Dashboard metrics
 * - agentHistory: runtime metadata (status, logPath, pid, bin) for Agents view
 *
 * Only 8 fields overlap (id, model, timestamps, tokens). Consolidating would
 * mix unrelated concerns and force components to handle irrelevant data.
 */
interface CostDataState {
  localAgents: AgentCostRecord[]
  isFetching: boolean
  totalCost: number
  fetchLocalAgents: () => Promise<void>
}

export const useCostDataStore = create<CostDataState>((set, get) => ({
  localAgents: [],
  isFetching: false,
  totalCost: 0,

  fetchLocalAgents: async (): Promise<void> => {
    if (get().isFetching) return
    set({ isFetching: true })
    try {
      const agents = await window.api.cost.getAgentHistory()
      const total = agents.reduce((sum, a) => sum + (a.costUsd ?? 0), 0)
      set({ localAgents: agents, totalCost: total })
    } catch (err) {
      console.error('[costData] fetchLocalAgents failed:', err)
    } finally {
      set({ isFetching: false })
    }
  }
}))
