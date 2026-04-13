import { useCallback, useEffect } from 'react'
import { useHealthCheckStore } from '../stores/healthCheck'
import { useBackoffInterval } from './useBackoffInterval'
import { POLL_HEALTH_CHECK_MS } from '../lib/constants'

/**
 * useHealthCheckPolling — polls for stuck tasks with backoff on errors.
 * Writes results to the healthCheck store. No return value.
 */
export function useHealthCheckPolling(): void {
  const setStuckTasks = useHealthCheckStore((s) => s.setStuckTasks)

  const runHealthCheck = useCallback(async () => {
    try {
      const stuck = await window.api.sprint.healthCheck()
      setStuckTasks(stuck.map((t) => t.id))
    } catch {
      /* silent */
    }
  }, [setStuckTasks])

  useEffect(() => {
    runHealthCheck()
  }, [runHealthCheck])
  useBackoffInterval(runHealthCheck, POLL_HEALTH_CHECK_MS)
}
