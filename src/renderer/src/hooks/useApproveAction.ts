import { useState } from 'react'
import { toast } from '../stores/toasts'

export interface UseApproveActionResult {
  approve: () => Promise<void>
  inFlight: boolean
}

export function useApproveAction(taskId: string, onSuccess: () => void): UseApproveActionResult {
  const [inFlight, setInFlight] = useState(false)

  const approve = async (): Promise<void> => {
    setInFlight(true)
    try {
      await window.api.review.approveTask({ taskId })
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
