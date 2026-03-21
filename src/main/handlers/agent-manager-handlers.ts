/**
 * Agent manager IPC handlers — proxied through the task-runner's Runner API.
 */
import { safeHandle } from '../ipc-utils'
import { listAgents, killAgent } from '../runner-client'

export function registerAgentManagerHandlers(): void {
  safeHandle('agent-manager:status', async () => {
    try {
      const agents = await listAgents()
      return { activeCount: Array.isArray(agents) ? agents.length : 0, availableSlots: null }
    } catch {
      return { activeCount: 0, availableSlots: null }
    }
  })

  safeHandle('agent-manager:kill', async (_e, agentId: string) => {
    return killAgent(agentId)
  })
}
