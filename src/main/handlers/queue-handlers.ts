import { safeHandle } from '../ipc-utils'
import { getQueueStats, getDoneTodayCount } from './sprint-local'
import { getSseClientCount } from '../queue-api/sse'
import { getEvents } from '../queue-api/event-store'

export function registerQueueHandlers(): void {
  safeHandle('queue:health', () => {
    const stats = getQueueStats()
    const connectedRunners = getSseClientCount()
    const doneToday = getDoneTodayCount()
    return { queue: stats, doneToday, connectedRunners }
  })

  safeHandle('task:getEvents', (_e, taskId) => {
    return getEvents(taskId)
  })
}
