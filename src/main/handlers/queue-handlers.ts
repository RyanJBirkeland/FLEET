import { safeHandle } from '../ipc-utils'
import { getQueueStats, getDoneTodayCount } from './sprint-local'
import { getSseClientCount } from '../queue-api/sse'
import { getEvents } from '../queue-api/event-store'
import { getTaskRunnerConfig } from '../config'

async function checkTaskRunnerAlive(): Promise<number> {
  const sseClients = getSseClientCount()
  if (sseClients > 0) return sseClients

  // Fallback: ping task runner health endpoint directly
  const config = getTaskRunnerConfig()
  if (!config) return 0
  try {
    const res = await fetch(`${config.url}/health`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(2000),
    })
    return res.ok ? 1 : 0
  } catch {
    return 0
  }
}

export function registerQueueHandlers(): void {
  safeHandle('queue:health', async () => {
    const stats = getQueueStats()
    const connectedRunners = await checkTaskRunnerAlive()
    const doneToday = getDoneTodayCount()
    return { queue: stats, doneToday, connectedRunners }
  })

  safeHandle('task:getEvents', (_e, taskId) => {
    return getEvents(taskId)
  })
}
