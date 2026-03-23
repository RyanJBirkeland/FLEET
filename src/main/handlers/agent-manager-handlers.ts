/**
 * Agent manager IPC handlers — delegates to the in-process AgentManager.
 */
import { safeHandle } from '../ipc-utils'

export function registerAgentManagerHandlers(): void {
  safeHandle('agent-manager:status', async () => {
    const am = (global as any).__agentManager
    if (!am) return { running: false, concurrency: null, activeAgents: [] }
    return am.getStatus()
  })

  safeHandle('agent-manager:kill', async (_e, taskId: string) => {
    const am = (global as any).__agentManager
    if (!am) throw new Error('Agent manager not available')
    am.killAgent(taskId)
    return { ok: true }
  })
}
