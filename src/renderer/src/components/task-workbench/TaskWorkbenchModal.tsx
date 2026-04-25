import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTaskWorkbenchModalStore } from '../../stores/taskWorkbenchModal'
import { useTaskWorkbenchStore } from '../../stores/taskWorkbench'
import { useCopilotStore } from '../../stores/copilot'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { ConfirmModal, useConfirm } from '../ui/ConfirmModal'
import { TaskWorkbench } from './TaskWorkbench'
import './TaskWorkbenchModal.css'

const DISCARD_CONFIRM = {
  title: 'Discard changes?',
  message: 'You have unsaved changes to this task. Discard them?',
  confirmLabel: 'Discard',
  variant: 'danger' as const
}

export function TaskWorkbenchModal(): React.JSX.Element | null {
  const open = useTaskWorkbenchModalStore((s) => s.open)
  const editingTask = useTaskWorkbenchModalStore((s) => s.editingTask)
  const close = useTaskWorkbenchModalStore((s) => s.close)
  const dialogRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)
  const { confirm, confirmProps } = useConfirm()

  useFocusTrap(dialogRef, open)

  // Reset the form on transition from open → closed so the next open starts
  // clean and the persisted draft is cleared when the user dismissed without
  // saving. Skip the very first render when the modal has never been opened.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return
    useTaskWorkbenchStore.getState().resetForm()
    const copilot = useCopilotStore.getState()
    if (copilot.visible) copilot.toggleVisible()
  }, [open])

  const requestDismiss = useCallback(async () => {
    const dirty = useTaskWorkbenchStore.getState().isDirty()
    if (!dirty) {
      close()
      return
    }
    const confirmed = await confirm(DISCARD_CONFIRM)
    if (confirmed) close()
  }, [close, confirm])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) void requestDismiss()
    },
    [requestDismiss]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        void requestDismiss()
      }
    },
    [requestDismiss]
  )

  if (!open) return null

  const title = editingTask ? formatEditTitle(editingTask.title) : 'New Task'

  return createPortal(
    <>
      <div
        className="task-workbench-modal__backdrop"
        onClick={handleBackdropClick}
        role="presentation"
      >
        <div
          ref={dialogRef}
          className="task-workbench-modal__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-workbench-modal-title"
          onKeyDown={handleKeyDown}
        >
          <header className="task-workbench-modal__header">
            <h2 id="task-workbench-modal-title" className="task-workbench-modal__title">
              {title}
            </h2>
            <button
              type="button"
              className="task-workbench-modal__close"
              onClick={() => void requestDismiss()}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </header>
          <div className="task-workbench-modal__body">
            <TaskWorkbench onSubmitted={close} />
          </div>
        </div>
      </div>
      <ConfirmModal {...confirmProps} />
    </>,
    document.body
  )
}

function formatEditTitle(taskTitle: string): string {
  const trimmed = taskTitle.trim()
  const truncated = trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed
  return `Edit: ${truncated}`
}
