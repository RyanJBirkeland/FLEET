import { getDb } from '../db'
import { safeHandle } from '../ipc-utils'
import { getDailySuccessRate } from '../services/sprint-service'
import { getLoadSnapshot } from '../services/load-sampler'
import {
  getCompletionsPerHour as _getCompletionsPerHour,
  getRecentEvents as _getRecentEvents
} from '../data/agent-queries'

export function getCompletionsPerHour(): {
  hour: string
  successCount: number
  failedCount: number
}[] {
  return _getCompletionsPerHour(getDb())
}

export function getRecentEvents(limit: number = 20): {
  id: number
  agent_id: string
  event_type: string
  payload: string
  timestamp: number
  task_title: string | null
}[] {
  return _getRecentEvents(getDb(), limit)
}

export function registerDashboardHandlers(): void {
  safeHandle('agent:completionsPerHour', async () => {
    return getCompletionsPerHour()
  })

  safeHandle('agent:recentEvents', async (_e: unknown, limit?: number) => {
    return getRecentEvents(limit)
  })

  safeHandle('dashboard:dailySuccessRate', async (_e: unknown, days?: number) => {
    return getDailySuccessRate(days)
  })

  safeHandle('system:loadAverage', async () => {
    return getLoadSnapshot()
  })

  safeHandle('clipboard:readImage', async () => {
    const { clipboard } = await import('electron')
    const img = clipboard.readImage()
    if (img.isEmpty()) return null
    const png = img.toPNG()
    return { data: png.toString('base64'), mimeType: 'image/png' as const }
  })
}
