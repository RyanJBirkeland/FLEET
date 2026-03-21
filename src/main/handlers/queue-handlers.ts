import { safeHandle } from '../ipc-utils'
import { getQueueStats, getDoneTodayCount } from './sprint-local'
import { getSseClientCount } from '../queue-api/sse'
import { getEvents } from '../queue-api/event-store'
import { getTaskRunnerConfig } from '../config'
import type { RecentHealth } from '../../shared/queue-api-contract'

async function checkTaskRunnerAlive(): Promise<{ connectedRunners: number; recentHealth: RecentHealth | null }> {
  const sseClients = getSseClientCount()

  // Always try to fetch full health for recentHealth data
  const config = getTaskRunnerConfig()
  if (!config) return { connectedRunners: sseClients > 0 ? sseClients : 0, recentHealth: null }

  try {
    const res = await fetch(`${config.url}/health`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return { connectedRunners: sseClients > 0 ? sseClients : 0, recentHealth: null }
    const data = await res.json() as { recentHealth?: RecentHealth }
    return {
      connectedRunners: sseClients > 0 ? sseClients : 1,
      recentHealth: data.recentHealth ?? null,
    }
  } catch {
    return { connectedRunners: sseClients > 0 ? sseClients : 0, recentHealth: null }
  }
}

export function registerQueueHandlers(): void {
  safeHandle('queue:health', async () => {
    const stats = getQueueStats()
    const { connectedRunners, recentHealth } = await checkTaskRunnerAlive()
    const doneToday = getDoneTodayCount()
    return { queue: stats, doneToday, connectedRunners, recentHealth }
  })

  safeHandle('task:getEvents', (_e, taskId) => {
    return getEvents(taskId)
  })
}
