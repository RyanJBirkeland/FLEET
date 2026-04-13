import { useCallback } from 'react'
import { useGitTreeStore } from '../stores/gitTree'
import { useBackoffInterval } from './useBackoffInterval'
import { POLL_GIT_STATUS_INTERVAL } from '../lib/constants'

export function useGitStatusPolling(): void {
  const activeRepo = useGitTreeStore((s) => s.activeRepo)
  const fetchStatus = useGitTreeStore((s) => s.fetchStatus)

  const poll = useCallback(() => {
    if (activeRepo) fetchStatus(activeRepo)
  }, [activeRepo, fetchStatus])

  useBackoffInterval(poll, activeRepo ? POLL_GIT_STATUS_INTERVAL : null)
}
