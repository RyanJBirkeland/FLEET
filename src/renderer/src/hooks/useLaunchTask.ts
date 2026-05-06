import { useCallback } from 'react'
import { useSprintTasks, selectActiveTaskCount } from '../stores/sprintTasks'
import { toast } from '../stores/toasts'
import { canLaunchTask } from '../lib/wip-policy'
import { WIP_LIMIT_IN_PROGRESS } from '../lib/constants'
import { TASK_STATUS } from '../../../shared/constants'
import { nowIso } from '../../../shared/time'
import { getRepoPaths } from '../services/git'
import { spawnLocal } from '../services/agents'
import type { SprintTask } from '../../../shared/types'

/**
 * useLaunchTask — use-case hook for launching an agent against a sprint task.
 *
 * Encapsulates repo-path resolution, agent spawning, and the resulting store
 * dispatch. The Zustand store owns state; this hook owns the orchestration.
 */
export function useLaunchTask(): (task: SprintTask) => Promise<void> {
  const activeCount = useSprintTasks(selectActiveTaskCount)
  const updateTask = useSprintTasks((s) => s.updateTask)

  return useCallback(
    async (task: SprintTask): Promise<void> => {
      if (task.status !== TASK_STATUS.ACTIVE) {
        if (!canLaunchTask(activeCount, WIP_LIMIT_IN_PROGRESS)) {
          toast.error(
            `In Progress is full (${WIP_LIMIT_IN_PROGRESS}/${WIP_LIMIT_IN_PROGRESS}) — finish or stop a task first`
          )
          return
        }
      }

      try {
        const repoPaths = await getRepoPaths()
        const repoPath = repoPaths[task.repo.toLowerCase()] ?? repoPaths[task.repo]
        if (!repoPath) {
          toast.error(`No repo path configured for "${task.repo}"`)
          return
        }

        // The state machine forbids backlog → active directly; promote to
        // queued first so the audit trail and transition rules stay consistent.
        if (task.status === TASK_STATUS.BACKLOG) {
          await updateTask(task.id, { status: TASK_STATUS.QUEUED })
        }

        const result = await spawnLocal({
          task: task.spec ?? task.title,
          repoPath
        })

        await updateTask(task.id, {
          status: TASK_STATUS.ACTIVE,
          agent_run_id: result.id,
          started_at: nowIso()
        })
        toast.success('Agent launched')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to launch agent')
      }
    },
    [activeCount, updateTask]
  )
}
