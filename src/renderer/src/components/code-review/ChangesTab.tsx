import './ChangesTab.css'
import { useMemo, useState } from 'react'
import { useCodeReviewStore } from '../../stores/codeReview'
import { useSprintTasks } from '../../stores/sprintTasks'
import { parseDiff } from '../../lib/diff-parser'
import { DiffViewer } from '../diff/DiffViewer'
import { EmptyState } from '../ui/EmptyState'
import { useReviewChanges } from '../../hooks/useReviewChanges'
import type { ReviewDiffSnapshot } from '../../../../shared/types'

function parseSnapshot(raw: string | null | undefined): ReviewDiffSnapshot | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as ReviewDiffSnapshot
  } catch {
    return null
  }
}

function canShowIncrementalDiff(
  snapshot: ReviewDiffSnapshot | null,
  retryCount: number | undefined,
  isSnapshot: boolean
): boolean {
  if (isSnapshot) return false
  if (!snapshot?.branchTip) return false
  return (retryCount ?? 0) > 0
}

export function ChangesTab(): React.JSX.Element {
  const selectedTaskId = useCodeReviewStore((s) => s.selectedTaskId)
  const tasks = useSprintTasks((s) => s.tasks)
  const task = tasks.find((t) => t.id === selectedTaskId)
  const snapshot = useMemo(() => parseSnapshot(task?.review_diff_snapshot), [task?.review_diff_snapshot])

  // Pair the incremental toggle with the task ID it applies to. When the task
  // selection changes, `incrementalTaskId !== selectedTaskId` evaluates to false
  // so the incremental diff is off without needing a separate reset effect.
  const [incrementalTaskId, setIncrementalTaskId] = useState<string | null>(null)
  const isIncrementalMode = incrementalTaskId === selectedTaskId

  const {
    files: diffFiles,
    loading,
    error,
    isSnapshot,
    snapshotCapturedAt,
    snapshotTruncated,
    fileDiff,
    retryDiff,
    incrementalDiff
  } = useReviewChanges(selectedTaskId, {
    enabled: isIncrementalMode,
    fromRef: snapshot?.branchTip ?? null
  })

  const showToggle = canShowIncrementalDiff(snapshot, task?.retry_count, isSnapshot)
  const activeFileDiff = isIncrementalMode ? incrementalDiff.diff : fileDiff
  const incrementalLoading = isIncrementalMode && incrementalDiff.loading

  // Parse the raw diff text into structured format for DiffViewer.
  // Must be called before early returns (React Hooks rule).
  const parsedDiff = useMemo(() => {
    if (!activeFileDiff) return []
    return parseDiff(activeFileDiff)
  }, [activeFileDiff])

  if (loading) {
    return (
      <div className="cr-changes">
        <div className="cr-changes__diff cr-changes__diff--loading">
          <div className="fleet-skeleton" style={{ height: 200 }} />
        </div>
      </div>
    )
  }

  if (diffFiles.length === 0) {
    const isWorktreeMissing =
      error !== null &&
      (error.includes('WorktreeMissingError') || error.includes('Worktree directory'))
    return (
      <div className="cr-changes">
        {isWorktreeMissing ? (
          <EmptyState
            title="Worktree not found"
            description="The agent worktree was removed. Restore it with git worktree add, then retry."
            action={{ label: 'Retry', onClick: retryDiff }}
          />
        ) : (
          <EmptyState message="No changes found in this branch." />
        )}
      </div>
    )
  }

  return (
    <div className="cr-changes" data-testid="cr-changes">
      {isSnapshot && (
        <div
          className="cr-changes__snapshot-banner"
          data-testid="cr-changes-snapshot-banner"
          title={snapshotCapturedAt ?? ''}
        >
          Worktree no longer available — showing archived snapshot
          {snapshotTruncated ? ' (file stats only — diff was too large to preserve)' : ''}
        </div>
      )}
      {showToggle && (
        <div className="cr-changes__incremental-bar">
          <button
            type="button"
            className={`cr-changes__incremental-toggle${isIncrementalMode ? ' cr-changes__incremental-toggle--on' : ''}`}
            aria-pressed={isIncrementalMode}
            onClick={() =>
              setIncrementalTaskId((prev) => (prev === selectedTaskId ? null : selectedTaskId))
            }
          >
            {isIncrementalMode ? 'Full diff' : 'Since last review'}
          </button>
        </div>
      )}
      <div className="cr-changes__diff">
        {incrementalLoading ? (
          <div className="cr-changes__diff cr-changes__diff--loading">
            <div className="fleet-skeleton" style={{ height: 200 }} />
          </div>
        ) : activeFileDiff ? (
          <DiffViewer files={parsedDiff} />
        ) : (
          <div className="cr-placeholder">
            {isIncrementalMode ? 'No changes since last review.' : 'Select a file to view diff'}
          </div>
        )}
      </div>
    </div>
  )
}
