import { useCallback } from 'react'
import { useSprintTasks } from '../stores/sprintTasks'
import { useConfirm } from '../components/ui/ConfirmModal'
import { toast } from '../stores/toasts'
import { TASK_STATUS } from '../../../shared/constants'
import type { SprintTask } from '../../../shared/types'

interface SprintTaskActions {
  handleSaveSpec: (taskId: string, spec: string) => Promise<void>
  handleStop: (task: SprintTask) => Promise<void>
  handleRerun: (task: SprintTask) => Promise<void>
  handleRetry: (task: SprintTask) => void
  launchTask: (task: SprintTask) => void
  deleteTask: (id: string) => Promise<void>
  confirmProps: ReturnType<typeof useConfirm>['confirmProps']
}

/**
 * useSprintTaskActions — all task mutation callbacks for SprintCenter.
 * Owns the confirm modal state so callers just spread `confirmProps` onto <ConfirmModal />.
 */
export function useSprintTaskActions(): SprintTaskActions {
  const updateTask = useSprintTasks((s) => s.updateTask)
  const deleteTask = useSprintTasks((s) => s.deleteTask)
  const launchTask = useSprintTasks((s) => s.launchTask)
  const loadData = useSprintTasks((s) => s.loadData)

  const { confirm, confirmProps } = useConfirm()

  // --- Save spec from drawer ---
  const handleSaveSpec = useCallback(
    (taskId: string, spec: string) => {
      return updateTask(taskId, { spec })
    },
    [updateTask]
  )

  // --- Stop running agent (with confirm) ---
  const handleStop = useCallback(
    async (task: SprintTask) => {
      if (task.status !== 'active') return
      const ok = await confirm({
        message: 'Stop this agent? The task will be marked cancelled.',
        confirmLabel: 'Stop Agent',
        variant: 'danger'
      })
      if (!ok) return
      try {
        const result = await window.api.agentManager.kill(task.id)
        if (result.ok) {
          updateTask(task.id, { status: TASK_STATUS.CANCELLED })
          toast.success('Agent stopped')
        } else {
          toast.error('Failed to stop agent')
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to stop agent')
      }
    },
    [updateTask, confirm]
  )

  // --- Re-queue a done/failed task as new ticket ---
  const handleRerun = useCallback(
    async (task: SprintTask) => {
      try {
        await window.api.sprint.create({
          title: task.title,
          repo: task.repo,
          prompt: task.prompt || task.title,
          spec: task.spec || undefined,
          priority: task.priority,
          status: TASK_STATUS.QUEUED
        })
        toast.success('Task re-queued as new ticket')
        loadData()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to re-queue task')
      }
    },
    [loadData]
  )

  // --- Retry errored/failed task in-place ---
  const handleRetry = useCallback(
    async (task: SprintTask) => {
      const ok = await confirm({
        title: 'Retry Task',
        message: `Retry "${task.title.slice(0, 50)}"? Previous agent work and logs will be cleared.`,
        confirmLabel: 'Retry',
        variant: 'danger'
      })
      if (!ok) return
      try {
        await window.api.sprint.retry(task.id)
        toast.success('Task re-queued for retry')
        loadData()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to retry task')
      }
    },
    [confirm, loadData]
  )

  return {
    handleSaveSpec,
    handleStop,
    handleRerun,
    handleRetry,
    launchTask,
    deleteTask,
    confirmProps
  }
}
