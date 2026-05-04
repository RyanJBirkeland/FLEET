import { useCallback, useEffect, useRef, useState } from 'react'
import type { SprintTask } from '../../../shared/types'

const LAST_CLOSE_KEY = 'fleet:last-window-close'

interface WindowSession {
  showBriefing: boolean
  briefingTasks: SprintTask[]
  dismissBriefing: () => void
}

/**
 * Tracks completions since the last window close and surfaces a briefing flag.
 * Reads and writes `fleet:last-window-close` in localStorage so the persistence
 * concern lives here, not in the view.
 */
export function useWindowSession(tasks: SprintTask[]): WindowSession {
  const [showBriefing, setShowBriefing] = useState(false)
  const [briefingTasks, setBriefingTasks] = useState<SprintTask[]>([])
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current || tasks.length === 0) return
    checked.current = true

    const stored = localStorage.getItem(LAST_CLOSE_KEY)
    if (!stored) return

    const lastCloseTime = parseInt(stored, 10)
    if (isNaN(lastCloseTime)) return

    const newCompletions = tasks.filter((task) => {
      if (!task.completed_at) return false
      return new Date(task.completed_at).getTime() > lastCloseTime
    })

    if (newCompletions.length > 0) {
      setBriefingTasks(newCompletions)
      setShowBriefing(true)
    }
  }, [tasks])

  const dismissBriefing = useCallback(() => {
    localStorage.setItem(LAST_CLOSE_KEY, Date.now().toString())
    setShowBriefing(false)
  }, [])

  return { showBriefing, briefingTasks, dismissBriefing }
}
