import { useState } from 'react'
import { toast } from '../stores/toasts'
import * as reviewService from '../services/review'

export interface UseApproveActionResult {
  approve: () => Promise<void>
  inFlight: boolean
}

export function useApproveAction(taskId: string, onSuccess: () => void): UseApproveActionResult {
  const [inFlight, setInFlight] = useState(false)

  const approve = async (): Promise<void> => {
    setInFlight(true)
    try {
      await reviewService.approveTask({ taskId })
      toast.success('Task approved — dependents unblocked')
      onSuccess()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve task')
    } finally {
      setInFlight(false)
    }
  }

  return { approve, inFlight }
}
