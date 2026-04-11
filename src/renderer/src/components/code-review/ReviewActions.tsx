import './ReviewActions.css'
import {
  GitMerge,
  GitPullRequest,
  RotateCcw,
  Trash2,
  Loader2,
  Rocket,
  RefreshCw
} from 'lucide-react'
import { useCodeReviewStore } from '../../stores/codeReview'
import { useSprintTasks } from '../../stores/sprintTasks'
import { ConfirmModal } from '../ui/ConfirmModal'
import { TextareaPromptModal } from '../ui/TextareaPromptModal'
import { useReviewActions } from '../../hooks/useReviewActions'

export function ReviewActions(): React.JSX.Element {
  const selectedTaskId = useCodeReviewStore((s) => s.selectedTaskId)
  const tasks = useSprintTasks((s) => s.tasks)
  const task = tasks.find((t) => t.id === selectedTaskId)
  const {
    actionInFlight,
    mergeStrategy,
    setMergeStrategy,
    freshness,
    ghConfigured,
    shipIt,
    mergeLocally,
    createPr,
    requestRevision,
    rebase,
    discard,
    confirmProps,
    promptProps
  } = useReviewActions()

  if (!task || task.status !== 'review') {
    return (
      <div className="cr-actions">
        <span className="cr-actions__hint">Select a task in review to see actions</span>
        <ConfirmModal {...confirmProps} />
        <TextareaPromptModal {...promptProps} />
      </div>
    )
  }

  return (
    <div className="cr-actions">
      <div className="cr-actions__rebase-status">
        <span
          className={`cr-actions__freshness cr-actions__freshness--${freshness.status}`}
          title={
            freshness.status === 'stale'
              ? `${freshness.commitsBehind} commit(s) behind main`
              : freshness.status === 'conflict'
                ? 'Last rebase had conflicts'
                : freshness.status === 'fresh'
                  ? 'Up to date with main'
                  : 'Checking...'
          }
        >
          {freshness.status === 'fresh' && 'Fresh'}
          {freshness.status === 'stale' && `Stale (${freshness.commitsBehind} behind)`}
          {freshness.status === 'conflict' && 'Conflict'}
          {freshness.status === 'unknown' && 'Unknown'}
          {freshness.status === 'loading' && '...'}
        </span>
        <button
          className="cr-actions__btn cr-actions__btn--ghost"
          onClick={rebase}
          disabled={!!actionInFlight || freshness.status === 'fresh'}
          title="Rebase agent branch onto current main"
        >
          {actionInFlight === 'rebase' ? (
            <Loader2 size={14} className="spin" />
          ) : (
            <RefreshCw size={14} />
          )}{' '}
          Rebase
        </button>
      </div>
      <div className="cr-actions__buttons-row">
        <div className="cr-actions__primary">
          <button
            className="cr-actions__btn cr-actions__btn--ship"
            onClick={shipIt}
            disabled={!!actionInFlight || !ghConfigured}
            title={!ghConfigured ? 'Configure GitHub in Settings \u2192 Connections' : undefined}
          >
            {actionInFlight === 'shipIt' ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <Rocket size={14} />
            )}{' '}
            Ship It
          </button>
          <div className="cr-actions__merge-group">
            <button
              className="cr-actions__btn cr-actions__btn--primary"
              onClick={mergeLocally}
              disabled={!!actionInFlight}
            >
              {actionInFlight === 'merge' ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <GitMerge size={14} />
              )}{' '}
              Merge Locally
            </button>
            <select
              className="cr-actions__strategy"
              value={mergeStrategy}
              onChange={(e) => setMergeStrategy(e.target.value as 'squash' | 'merge' | 'rebase')}
              disabled={!!actionInFlight}
            >
              <option value="squash">Squash</option>
              <option value="merge">Merge</option>
              <option value="rebase">Rebase</option>
            </select>
          </div>
          <button
            className="cr-actions__btn cr-actions__btn--secondary"
            onClick={createPr}
            disabled={!!actionInFlight || !ghConfigured}
            title={!ghConfigured ? 'Configure GitHub in Settings \u2192 Connections' : undefined}
          >
            {actionInFlight === 'createPr' ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <GitPullRequest size={14} />
            )}{' '}
            Create PR
          </button>
        </div>
        <div className="cr-actions__secondary">
          <button
            className="cr-actions__btn cr-actions__btn--ghost"
            onClick={requestRevision}
            disabled={!!actionInFlight}
          >
            {actionInFlight === 'revise' ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <RotateCcw size={14} />
            )}{' '}
            Revise
          </button>
          <button
            className="cr-actions__btn cr-actions__btn--danger"
            onClick={discard}
            disabled={!!actionInFlight}
          >
            {actionInFlight === 'discard' ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <Trash2 size={14} />
            )}{' '}
            Discard
          </button>
        </div>
      </div>
      <ConfirmModal {...confirmProps} />
      <TextareaPromptModal {...promptProps} />
    </div>
  )
}
