import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { SprintTask } from '../../../../shared/types'
import { useSprintTasks } from '../../stores/sprintTasks'
import { useSprintSelection } from '../../stores/sprintSelection'
import { useAgentEvents } from '../../stores/agentEvents'
import { formatElapsed } from '../../lib/task-format'
import { useBackoffInterval } from '../../hooks/useBackoffInterval'
import { useNow } from '../../hooks/useNow'
import { useGitHubStatus } from '../../hooks/useGitHubStatus'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { ConfirmModal, useConfirm } from '../ui/ConfirmModal'
import { TextareaPromptModal } from '../ui/TextareaPromptModal'
import { useTaskCost } from '../../hooks/useTaskCost'
import { useOperatorActions } from '../../hooks/useOperatorActions'
import { TaskDetailActionButtons } from './TaskDetailActionButtons'
import { TaskDrawerHeader } from './TaskDrawerHeader'
import { TaskDrawerEvents } from './TaskDrawerEvents'
import { TaskDrawerFailureDiagnostics } from './TaskDrawerFailureDiagnostics'
import { TaskDrawerOperatorActions } from './TaskDrawerOperatorActions'
import {
  SpecSection,
  LiveRunSection,
  DependenciesSection,
  MetadataSection,
  BranchOnlySection
} from './TaskDrawerSections'
export interface TaskDetailDrawerProps {
  task: SprintTask
  onClose: () => void
  onLaunch: (task: SprintTask) => void
  onStop: (task: SprintTask) => void
  onDelete: (task: SprintTask) => void
  onViewLogs: (task: SprintTask) => void
  onOpenSpec: () => void
  onEdit: (task: SprintTask) => void
  onViewAgents: (agentId: string) => void
  onUnblock?: ((task: SprintTask) => void) | undefined
  onRetry?: ((task: SprintTask) => void) | undefined
  onReviewChanges?: ((task: SprintTask) => void) | undefined
  onExport?: ((task: SprintTask) => void) | undefined
}

export function TaskDetailDrawer({
  task,
  onClose,
  onLaunch,
  onStop,
  onDelete,
  onViewLogs,
  onOpenSpec,
  onEdit,
  onViewAgents,
  onUnblock,
  onRetry,
  onReviewChanges,
  onExport
}: TaskDetailDrawerProps): React.JSX.Element {
  const titleRef = useRef<HTMLParagraphElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const titleId = `task-detail-title-${task.id}`
  const { configured: ghConfigured } = useGitHubStatus()

  useEffect(() => { titleRef.current?.focus() }, [task.id])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  useFocusTrap(drawerRef, false)

  const safeStartedAt = task.started_at ?? new Date().toISOString()
  const isActive = task.status === 'active' && !!task.started_at
  const [elapsed, setElapsed] = useState(() => (isActive ? formatElapsed(safeStartedAt) : ''))
  useBackoffInterval(() => setElapsed(formatElapsed(safeStartedAt)), isActive ? 10_000 : null)

  const setSelectedTaskId = useSprintSelection((s) => s.setSelectedTaskId)
  const depTaskIds = useMemo(() => new Set((task.depends_on ?? []).map((d) => d.id)), [task.depends_on])
  const depTasks = useSprintTasks(
    useShallow((s) => s.tasks.filter((t) => depTaskIds.has(t.id)).map((t) => ({ id: t.id, title: t.title, status: t.status })))
  )
  const agentRunId = task.agent_run_id
  const allAgentEvents = useAgentEvents(agentRunId)
  const recentAgentErrors = useMemo(() => allAgentEvents.filter((e) => e.type === 'agent:error').slice(-3), [allAgentEvents])

  const { costUsd } = useTaskCost(task.agent_run_id)
  const now = useNow()
  const progressPct = !task.started_at || !task.max_runtime_ms ? 0
    : Math.min(100, Math.round(((now - new Date(task.started_at).getTime()) / task.max_runtime_ms) * 100))

  const { handlers: operatorHandlers, modalProps: operatorModalProps } = useOperatorActions(task.id)
  const { confirm: confirmDelete, confirmProps: deleteConfirmProps } = useConfirm()

  async function handleDelete(): Promise<void> {
    const approved = await confirmDelete({
      title: 'Delete task?',
      message: `"${task.title}" will be permanently removed.`,
      confirmLabel: 'Delete',
      variant: 'danger'
    })
    if (!approved) return
    onDelete(task)
  }

  return (
    <div ref={drawerRef} style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--line)', background: 'var(--bg)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} role="complementary" aria-labelledby={titleId} data-testid="task-detail-drawer">
      <TaskDrawerHeader task={task} titleRef={titleRef} titleId={titleId} onClose={onClose} />
      <div style={{ padding: 'var(--s-3) var(--s-4)', borderBottom: '1px solid var(--line)' }}>
        <TaskDetailActionButtons task={task} onLaunch={onLaunch} onStop={onStop} onDelete={handleDelete} onViewLogs={onViewLogs} onEdit={onEdit} onUnblock={onUnblock} onRetry={onRetry} onReviewChanges={onReviewChanges} onExport={onExport} />
      </div>
      <SpecSection task={task} onOpenSpec={onOpenSpec} />
      {(task.status === 'active' || (task.status === 'queued' && task.claimed_by)) && (
        <LiveRunSection task={task} elapsed={elapsed} progressPct={progressPct} costUsd={costUsd} />
      )}
      {(task.depends_on?.length ?? 0) > 0 && (
        <DependenciesSection task={task} depTasks={depTasks} onSelectTask={setSelectedTaskId} />
      )}
      <TaskDrawerEvents events={allAgentEvents} />
      <MetadataSection task={task} agentRunId={agentRunId} onViewAgents={onViewAgents} />
      <TaskDrawerFailureDiagnostics task={task} recentAgentErrors={recentAgentErrors} />
      {task.pr_status === 'branch_only' && <BranchOnlySection notes={task.notes} ghConfigured={ghConfigured} />}
      <TaskDrawerOperatorActions
        task={task}
        onMarkFailed={operatorHandlers.markFailed}
        onForceDone={operatorHandlers.forceDone}
        onForceRelease={operatorHandlers.forceRelease}
      />
      <TextareaPromptModal {...operatorModalProps.reasonPromptProps} />
      <ConfirmModal {...operatorModalProps.forceDoneConfirmProps} />
      <ConfirmModal {...operatorModalProps.forceReleaseConfirmProps} />
      <ConfirmModal {...deleteConfirmProps} />
    </div>
  )
}
