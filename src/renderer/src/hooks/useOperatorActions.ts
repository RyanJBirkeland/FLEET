import { useCallback } from 'react'
import { useConfirm } from '../components/ui/ConfirmModal'
import { useTextareaPrompt } from '../components/ui/TextareaPromptModal'
import { useSprintTaskActions } from './useSprintTaskActions'

type ConfirmProps = ReturnType<typeof useConfirm>['confirmProps']
type TextareaPromptProps = ReturnType<typeof useTextareaPrompt>['promptProps']

export interface OperatorActionHandlers {
  markFailed: () => Promise<void>
  forceDone: () => Promise<void>
  forceRelease: () => Promise<void>
}

export interface OperatorActionModalProps {
  reasonPromptProps: TextareaPromptProps
  forceDoneConfirmProps: ConfirmProps
  forceReleaseConfirmProps: ConfirmProps
}

export interface UseOperatorActionsResult {
  handlers: OperatorActionHandlers
  modalProps: OperatorActionModalProps
}

/**
 * Encapsulates the three operator-override flows for a sprint task —
 * mark-failed (with reason prompt), force-done (with confirm), and
 * force-release (with confirm). Returns the three action handlers plus
 * the modal props the host component must render.
 *
 * The host renders {@link TextareaPromptModal} and two
 * {@link ConfirmModal} instances using the props in `modalProps`.
 */
export function useOperatorActions(taskId: string): UseOperatorActionsResult {
  const { prompt: promptForReason, promptProps: reasonPromptProps } = useTextareaPrompt()
  const { confirm: confirmForceDone, confirmProps: forceDoneConfirmProps } = useConfirm()
  const { confirm: confirmForceRelease, confirmProps: forceReleaseConfirmProps } = useConfirm()
  const { markTaskFailed, forceTaskDone, releaseTask } = useSprintTaskActions()

  const markFailed = useCallback(async (): Promise<void> => {
    const reason = await promptForReason({
      title: 'Mark task as failed?',
      message:
        'Agent will stop retrying and downstream tasks will unblock as if the task had failed normally. Optionally provide a reason for the audit trail.',
      placeholder: 'Reason (optional) — e.g. "scope changed, dropping this task"',
      confirmLabel: 'Mark Failed'
    })
    if (reason === null) return
    await markTaskFailed(taskId, reason.trim() || undefined)
  }, [promptForReason, markTaskFailed, taskId])

  const forceDone = useCallback(async (): Promise<void> => {
    const approved = await confirmForceDone({
      title: 'Force mark task as done?',
      message:
        'This will trigger dependency resolution as if the agent succeeded. Use only if you have manually shipped the work.',
      confirmLabel: 'Force Done',
      variant: 'danger'
    })
    if (!approved) return
    await forceTaskDone(taskId)
  }, [confirmForceDone, forceTaskDone, taskId])

  const forceRelease = useCallback(async (): Promise<void> => {
    const approved = await confirmForceRelease({
      title: 'Force-release this task?',
      message:
        'The task will return to queued and the agent manager will pick it up again. Use this if the agent process died without releasing the claim.',
      confirmLabel: 'Force Release',
      variant: 'danger'
    })
    if (!approved) return
    await releaseTask(taskId)
  }, [confirmForceRelease, releaseTask, taskId])

  return {
    handlers: { markFailed, forceDone, forceRelease },
    modalProps: { reasonPromptProps, forceDoneConfirmProps, forceReleaseConfirmProps }
  }
}
