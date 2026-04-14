import { useCodeReviewStore } from '../stores/codeReview'
import { useSprintTasks } from '../stores/sprintTasks'
import { toast } from '../stores/toasts'

export interface UseBatchReviewActionsResult {
  batchMergeLocally: (tasks: Array<{ id: string; title: string }>) => Promise<void>
  batchShipIt: (tasks: Array<{ id: string; title: string }>) => Promise<void>
  batchCreatePr: (
    tasks: Array<{ id: string; title: string; spec?: string; prompt?: string }>
  ) => Promise<void>
  batchDiscard: (tasks: Array<{ id: string; title: string }>) => Promise<void>
}

export function useBatchReviewActions(): UseBatchReviewActionsResult {
  const loadData = useSprintTasks((s) => s.loadData)

  const batchMergeLocally = async (
    batchTasks: Array<{ id: string; title: string }>
  ): Promise<void> => {
    const clearBatch = useCodeReviewStore.getState().clearBatch
    let succeeded = 0
    let failed = 0

    for (const batchTask of batchTasks) {
      try {
        const result = await window.api.review.mergeLocally({
          taskId: batchTask.id,
          strategy: 'squash'
        })
        if (result.success) succeeded++
        else failed++
      } catch {
        failed++
      }
    }

    clearBatch()
    loadData()

    if (failed === 0) {
      toast.success(`Merged ${succeeded} tasks`)
    } else {
      toast.error(`Merged ${succeeded}, failed ${failed}`)
    }
  }

  const batchShipIt = async (batchTasks: Array<{ id: string; title: string }>): Promise<void> => {
    const clearBatch = useCodeReviewStore.getState().clearBatch
    let succeeded = 0
    let failed = 0

    for (const batchTask of batchTasks) {
      try {
        const result = await window.api.review.shipIt({
          taskId: batchTask.id,
          strategy: 'squash'
        })
        if (result.success) succeeded++
        else failed++
      } catch {
        failed++
      }
    }

    clearBatch()
    loadData()

    if (failed === 0) {
      toast.success(`Shipped ${succeeded} tasks`)
    } else {
      toast.error(`Shipped ${succeeded}, failed ${failed}`)
    }
  }

  const batchCreatePr = async (
    batchTasks: Array<{ id: string; title: string; spec?: string; prompt?: string }>
  ): Promise<void> => {
    const clearBatch = useCodeReviewStore.getState().clearBatch
    let succeeded = 0
    let failed = 0

    for (const batchTask of batchTasks) {
      try {
        await window.api.review.createPr({
          taskId: batchTask.id,
          title: batchTask.title,
          body: batchTask.spec || batchTask.prompt || ''
        })
        succeeded++
      } catch {
        failed++
      }
    }

    clearBatch()
    loadData()

    if (failed === 0) {
      toast.success(`Created ${succeeded} PRs`)
    } else {
      toast.error(`Created ${succeeded} PRs, failed ${failed}`)
    }
  }

  const batchDiscard = async (
    batchTasks: Array<{ id: string; title: string }>
  ): Promise<void> => {
    const clearBatch = useCodeReviewStore.getState().clearBatch
    let succeeded = 0
    let failed = 0

    for (const batchTask of batchTasks) {
      try {
        await window.api.review.discard({ taskId: batchTask.id })
        succeeded++
      } catch {
        failed++
      }
    }

    clearBatch()
    loadData()

    if (failed === 0) {
      toast.success(`Discarded ${succeeded} tasks`)
    } else {
      toast.error(`Discarded ${succeeded} tasks, failed ${failed}`)
    }
  }

  return {
    batchMergeLocally,
    batchShipIt,
    batchCreatePr,
    batchDiscard
  }
}
