import { useCallback, useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import type { SprintTask } from '../../../../shared/types'
import { toast } from '../../stores/toasts'

export interface ActionButtonsProps {
  task: SprintTask
  onLaunch: (t: SprintTask) => void
  onStop: (t: SprintTask) => void
  onDelete: (t: SprintTask) => void
  onViewLogs: (t: SprintTask) => void
  onEdit: (t: SprintTask) => void
  onUnblock?: ((t: SprintTask) => void) | undefined
  onRetry?: ((t: SprintTask) => void) | undefined
  onExport?: ((t: SprintTask) => void) | undefined
  onReviewChanges?: ((t: SprintTask) => void) | undefined
}

const primaryStyle: React.CSSProperties = {
  flex: 1,
  height: 28,
  padding: '0 var(--s-2)',
  borderRadius: 'var(--r-md)',
  background: 'var(--accent)',
  color: 'var(--accent-fg)',
  border: 'none',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  justifyContent: 'center',
}

const secondaryStyle: React.CSSProperties = {
  flex: 1,
  height: 28,
  padding: '0 var(--s-2)',
  borderRadius: 'var(--r-md)',
  background: 'transparent',
  color: 'var(--fg-2)',
  border: '1px solid var(--line)',
  fontSize: 11,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  justifyContent: 'center',
}

const dangerStyle: React.CSSProperties = {
  flex: 1,
  height: 28,
  padding: '0 var(--s-2)',
  borderRadius: 'var(--r-md)',
  background: 'transparent',
  color: 'var(--st-failed)',
  border: '1px solid color-mix(in oklch, var(--st-failed) 30%, transparent)',
  fontSize: 11,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  justifyContent: 'center',
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--s-1)',
  flexWrap: 'wrap',
}

export function TaskDetailActionButtons({
  task,
  onLaunch,
  onStop,
  onDelete,
  onViewLogs,
  onEdit,
  onUnblock,
  onRetry,
  onExport,
  onReviewChanges,
}: ActionButtonsProps): React.JSX.Element {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const isLoading = loadingAction !== null

  const handleAction = useCallback(
    async (actionName: string, handler: (t: SprintTask) => void | Promise<void>) => {
      setLoadingAction(actionName)
      try {
        await Promise.resolve(handler(task))
      } catch (error) {
        toast.error(`${actionName} failed: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        setLoadingAction(null)
      }
    },
    [task]
  )

  switch (task.status) {
    case 'backlog':
    case 'queued':
      return (
        <div style={containerStyle}>
          <button
            style={primaryStyle}
            onClick={() => handleAction('launch', onLaunch)}
            disabled={isLoading}
            aria-busy={loadingAction === 'launch'}
          >
            {loadingAction === 'launch' && <Loader2 size={12} className="spinner" />}
            Launch
          </button>
          <button
            style={secondaryStyle}
            onClick={() => handleAction('edit', onEdit)}
            disabled={isLoading}
            aria-busy={loadingAction === 'edit'}
          >
            {loadingAction === 'edit' && <Loader2 size={12} className="spinner" />}
            Edit
          </button>
          <button
            style={dangerStyle}
            onClick={() => handleAction('delete', onDelete)}
            disabled={isLoading}
            aria-busy={loadingAction === 'delete'}
          >
            {loadingAction === 'delete' && <Loader2 size={12} className="spinner" />}
            Delete
          </button>
        </div>
      )

    case 'blocked':
      return (
        <div style={containerStyle}>
          <button
            style={primaryStyle}
            onClick={() => handleAction('unblock', onUnblock ?? onLaunch)}
            disabled={isLoading}
            aria-busy={loadingAction === 'unblock'}
          >
            {loadingAction === 'unblock' && <Loader2 size={12} className="spinner" />}
            Unblock
          </button>
          <button
            style={secondaryStyle}
            onClick={() => handleAction('edit', onEdit)}
            disabled={isLoading}
            aria-busy={loadingAction === 'edit'}
          >
            {loadingAction === 'edit' && <Loader2 size={12} className="spinner" />}
            Edit
          </button>
          <button
            style={dangerStyle}
            onClick={() => handleAction('delete', onDelete)}
            disabled={isLoading}
            aria-busy={loadingAction === 'delete'}
          >
            {loadingAction === 'delete' && <Loader2 size={12} className="spinner" />}
            Delete
          </button>
        </div>
      )

    case 'active':
      return (
        <div style={containerStyle}>
          <button
            style={primaryStyle}
            onClick={() => handleAction('viewLogs', onViewLogs)}
            disabled={isLoading}
            aria-busy={loadingAction === 'viewLogs'}
          >
            {loadingAction === 'viewLogs' && <Loader2 size={12} className="spinner" />}
            Open in Agents
          </button>
          <button
            style={dangerStyle}
            onClick={() => handleAction('stop', onStop)}
            disabled={isLoading}
            aria-busy={loadingAction === 'stop'}
          >
            {loadingAction === 'stop' && <Loader2 size={12} className="spinner" />}
            Stop
          </button>
        </div>
      )

    case 'review':
      return (
        <div style={containerStyle}>
          {onReviewChanges && (
            <button
              style={primaryStyle}
              onClick={() => handleAction('reviewChanges', onReviewChanges)}
              disabled={isLoading}
              aria-busy={loadingAction === 'reviewChanges'}
            >
              {loadingAction === 'reviewChanges' && <Loader2 size={12} className="spinner" />}
              Review Changes
            </button>
          )}
          <button
            style={secondaryStyle}
            onClick={() => handleAction('openSpec', onEdit)}
            disabled={isLoading}
            aria-busy={loadingAction === 'openSpec'}
          >
            {loadingAction === 'openSpec' && <Loader2 size={12} className="spinner" />}
            Open Spec
          </button>
          <button
            style={dangerStyle}
            onClick={() => handleAction('delete', onDelete)}
            disabled={isLoading}
            aria-busy={loadingAction === 'delete'}
          >
            {loadingAction === 'delete' && <Loader2 size={12} className="spinner" />}
            Discard
          </button>
        </div>
      )

    case 'approved':
      return (
        <div style={containerStyle}>
          <button
            style={secondaryStyle}
            onClick={() => handleAction('openSpec', onEdit)}
            disabled={isLoading}
            aria-busy={loadingAction === 'openSpec'}
          >
            {loadingAction === 'openSpec' && <Loader2 size={12} className="spinner" />}
            Open Spec
          </button>
          <button
            style={dangerStyle}
            onClick={() => handleAction('delete', onDelete)}
            disabled={isLoading}
            aria-busy={loadingAction === 'delete'}
          >
            {loadingAction === 'delete' && <Loader2 size={12} className="spinner" />}
            Delete
          </button>
        </div>
      )

    case 'done':
      return (
        <div style={containerStyle}>
          <button
            style={secondaryStyle}
            onClick={() => handleAction('viewLogs', onViewLogs)}
            disabled={isLoading}
            aria-busy={loadingAction === 'viewLogs'}
          >
            {loadingAction === 'viewLogs' && <Loader2 size={12} className="spinner" />}
            Open in Agents
          </button>
          {onExport && (
            <button
              style={secondaryStyle}
              onClick={() => handleAction('export', onExport)}
              disabled={isLoading}
              aria-busy={loadingAction === 'export'}
              title="Export task history"
            >
              {loadingAction === 'export' ? (
                <Loader2 size={12} className="spinner" />
              ) : null}
              Export
            </button>
          )}
        </div>
      )

    case 'failed':
    case 'error':
      return (
        <div style={containerStyle}>
          {onRetry && (
            <button
              style={primaryStyle}
              onClick={() => handleAction('retry', onRetry)}
              disabled={isLoading}
              aria-busy={loadingAction === 'retry'}
              aria-label={`Retry task ${task.title}`}
            >
              {loadingAction === 'retry' ? (
                <Loader2 size={12} className="spinner" />
              ) : (
                <RefreshCw size={12} />
              )}
              Retry
            </button>
          )}
          <button
            style={secondaryStyle}
            onClick={() => handleAction('edit', onEdit)}
            disabled={isLoading}
            aria-busy={loadingAction === 'edit'}
          >
            {loadingAction === 'edit' && <Loader2 size={12} className="spinner" />}
            Edit
          </button>
          <button
            style={dangerStyle}
            onClick={() => handleAction('delete', onDelete)}
            disabled={isLoading}
            aria-busy={loadingAction === 'delete'}
          >
            {loadingAction === 'delete' && <Loader2 size={12} className="spinner" />}
            Delete
          </button>
        </div>
      )

    case 'cancelled':
      return (
        <div style={containerStyle}>
          {onRetry && (
            <button
              style={primaryStyle}
              onClick={() => handleAction('retry', onRetry)}
              disabled={isLoading}
              aria-busy={loadingAction === 'retry'}
              aria-label={`Retry task ${task.title}`}
            >
              {loadingAction === 'retry' ? (
                <Loader2 size={12} className="spinner" />
              ) : (
                <RefreshCw size={12} />
              )}
              Retry
            </button>
          )}
          <button
            style={dangerStyle}
            onClick={() => handleAction('delete', onDelete)}
            disabled={isLoading}
            aria-busy={loadingAction === 'delete'}
          >
            {loadingAction === 'delete' && <Loader2 size={12} className="spinner" />}
            Delete
          </button>
        </div>
      )

    default:
      return <></>
  }
}
