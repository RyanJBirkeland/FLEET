import type { AgentCostRecord } from '../../../shared/types'

export async function getAgentCostHistory(): Promise<AgentCostRecord[]> {
  return window.api.cost.getAgentHistory()
}
