/**
 * useDesktopNotifications — triggers desktop notifications for critical background events.
 * Only fires when app window is NOT focused (!document.hasFocus()).
 * Listens to:
 * - Task status transitions (active → done, active → review, active → failed/error)
 * - PR merged events (prMergedMap changes)
 *
 * Adds notifications to the persistent notifications store for the in-app notification center.
 */
import { useEffect, useRef, useState } from 'react'
import { useSprintTasks } from '../stores/sprintTasks'
import { useNotificationsStore } from '../stores/notifications'
import { usePanelLayoutStore } from '../stores/panelLayout'
import { TASK_STATUS } from '../../../shared/constants'
import type { SprintTask } from '../../../shared/types'

function requestPermissionOnce(): void {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function shouldNotify(): boolean {
  // Only notify if window is not focused
  return !document.hasFocus()
}

function fireDesktopNotification(
  title: string,
  body: string,
  onClick?: () => void
): Notification | null {
  if (!('Notification' in window)) return null
  if (Notification.permission !== 'granted') return null

  const notification = new Notification(title, { body, silent: false })
  if (onClick) {
    notification.onclick = onClick
  }
  return notification
}

export function useDesktopNotifications(): void {
  const tasks = useSprintTasks((s) => s.tasks)
  const prMergedMap = useSprintTasks((s) => s.prMergedMap)
  const addNotification = useNotificationsStore((s) => s.addNotification)
  const setView = usePanelLayoutStore((s) => s.setView)

  const prevTasksRef = useRef<Map<string, SprintTask>>(new Map())
  const prevPrMergedRef = useRef<Record<string, boolean>>({})
  const initializedRef = useRef(false)
  const notifiedTasksRef = useRef<Set<string>>(new Set())
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  // Load notifications setting
  useEffect(() => {
    window.api.settings
      .get('notifications.enabled')
      .then((value) => {
        if (typeof value === 'boolean') {
          setNotificationsEnabled(value)
        }
      })
      .catch(() => {
        // Default to enabled if setting doesn't exist
        setNotificationsEnabled(true)
      })
  }, [])

  // Request permission on mount
  useEffect(() => {
    requestPermissionOnce()
  }, [])

  // Watch for task status changes
  useEffect(() => {
    if (!notificationsEnabled) return

    const prevMap = prevTasksRef.current
    const currentMap = new Map(tasks.map((t) => [t.id, t]))

    // Skip initial render — seed without notifying
    if (!initializedRef.current) {
      prevTasksRef.current = currentMap
      initializedRef.current = true
      return
    }

    const handleNotificationClick = (): void => {
      window.focus()
      setView('code-review')
    }

    for (const task of tasks) {
      const prev = prevMap.get(task.id)
      if (!prev) continue

      // Skip if we already notified for this task
      if (notifiedTasksRef.current.has(task.id)) continue

      // Agent completed: active → review
      if (prev.status === TASK_STATUS.ACTIVE && task.status === TASK_STATUS.REVIEW) {
        const title = 'BDE: Task Ready for Review'
        const message = `${task.title}`

        addNotification({
          type: 'agent_completed',
          title,
          message,
          viewLink: `/sprint/${task.id}`
        })

        if (shouldNotify()) {
          fireDesktopNotification(title, message, handleNotificationClick)
        }
        notifiedTasksRef.current.add(task.id)
      }

      // Agent completed: active → done
      if (prev.status === TASK_STATUS.ACTIVE && task.status === TASK_STATUS.DONE) {
        const title = 'BDE: Task Completed'
        const message = task.pr_url ? `${task.title} — PR ready` : `${task.title}`

        addNotification({
          type: 'agent_completed',
          title,
          message,
          viewLink: `/sprint/${task.id}`
        })

        if (shouldNotify()) {
          fireDesktopNotification(title, message, handleNotificationClick)
        }
        notifiedTasksRef.current.add(task.id)
      }

      // Agent failed: active → failed
      if (prev.status === TASK_STATUS.ACTIVE && task.status === TASK_STATUS.FAILED) {
        const title = 'BDE: Task Failed'
        const message = `${task.title}`

        addNotification({
          type: 'agent_failed',
          title,
          message,
          viewLink: `/sprint/${task.id}`
        })

        if (shouldNotify()) {
          fireDesktopNotification(title, message, handleNotificationClick)
        }
        notifiedTasksRef.current.add(task.id)
      }

      // Agent error: active → error
      if (prev.status === TASK_STATUS.ACTIVE && task.status === TASK_STATUS.ERROR) {
        const title = 'BDE: Task Error'
        const message = `${task.title}`

        addNotification({
          type: 'agent_failed',
          title,
          message,
          viewLink: `/sprint/${task.id}`
        })

        if (shouldNotify()) {
          fireDesktopNotification(title, message, handleNotificationClick)
        }
        notifiedTasksRef.current.add(task.id)
      }
    }

    prevTasksRef.current = currentMap
  }, [tasks, addNotification, notificationsEnabled, setView])

  // Watch for PR merged events
  useEffect(() => {
    if (!notificationsEnabled) return

    const prev = prevPrMergedRef.current

    const handleNotificationClick = (): void => {
      window.focus()
      setView('code-review')
    }

    for (const [taskId, merged] of Object.entries(prMergedMap)) {
      // Skip if already merged in previous state
      if (prev[taskId] === merged) continue
      // Only fire if newly merged
      if (!merged) continue
      // Skip if we already notified
      if (notifiedTasksRef.current.has(`${taskId}-merged`)) continue

      const task = tasks.find((t) => t.id === taskId)
      if (!task) continue

      const title = 'BDE: PR Merged'
      const message = `${task.title} — PR #${task.pr_number || 'unknown'} merged`

      addNotification({
        type: 'pr_merged',
        title,
        message,
        viewLink: task.pr_url || undefined
      })

      if (shouldNotify()) {
        fireDesktopNotification(title, message, handleNotificationClick)
      }
      notifiedTasksRef.current.add(`${taskId}-merged`)
    }

    prevPrMergedRef.current = prMergedMap
  }, [prMergedMap, tasks, addNotification, notificationsEnabled, setView])
}
