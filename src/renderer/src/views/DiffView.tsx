/**
 * DiffView — thin render layer for the git client UI.
 * All state and logic lives in stores/diffView.ts.
 */
import { useEffect } from 'react'
import { useVisibilityAwareInterval } from '../hooks/useVisibilityAwareInterval'
import { GitBranch } from 'lucide-react'
import { DiffViewer } from '../components/diff/DiffViewer'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { DiffSizeWarning } from '../components/diff/DiffSizeWarning'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { POLL_GIT_STATUS_INTERVAL } from '../lib/constants'
import { useDiffViewStore } from '../stores/diffView'

function statusLabel(status: string): string {
  switch (status) {
    case 'M':
      return 'modified'
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case '?':
      return 'untracked'
    case 'R':
      return 'renamed'
    case 'C':
      return 'copied'
    default:
      return status
  }
}

function DiffView(): React.JSX.Element {
  // Extract individual selectors to avoid re-rendering on unrelated state changes
  const repos = useDiffViewStore((s) => s.repos)
  const selectedRepo = useDiffViewStore((s) => s.selectedRepo)
  const branches = useDiffViewStore((s) => s.branches)
  const currentBranch = useDiffViewStore((s) => s.currentBranch)
  const files = useDiffViewStore((s) => s.files)
  const selectedFile = useDiffViewStore((s) => s.selectedFile)
  const diffFiles = useDiffViewStore((s) => s.diffFiles)
  const stagedSet = useDiffViewStore((s) => s.stagedSet)
  const commitMsg = useDiffViewStore((s) => s.commitMsg)
  const loading = useDiffViewStore((s) => s.loading)
  const pushing = useDiffViewStore((s) => s.pushing)
  const committing = useDiffViewStore((s) => s.committing)
  const pushOutput = useDiffViewStore((s) => s.pushOutput)
  const error = useDiffViewStore((s) => s.error)
  const diffSizeWarning = useDiffViewStore((s) => s.diffSizeWarning)

  const loadRepos = useDiffViewStore((s) => s.loadRepos)
  const selectRepo = useDiffViewStore((s) => s.selectRepo)
  const setSelectedFile = useDiffViewStore((s) => s.setSelectedFile)
  const setCommitMsg = useDiffViewStore((s) => s.setCommitMsg)
  const setPushOutput = useDiffViewStore((s) => s.setPushOutput)
  const refresh = useDiffViewStore((s) => s.refresh)
  const loadDiff = useDiffViewStore((s) => s.loadDiff)
  const toggleStage = useDiffViewStore((s) => s.toggleStage)
  const stageAll = useDiffViewStore((s) => s.stageAll)
  const unstageAll = useDiffViewStore((s) => s.unstageAll)
  const commit = useDiffViewStore((s) => s.commit)
  const push = useDiffViewStore((s) => s.push)
  const switchBranch = useDiffViewStore((s) => s.switchBranch)
  const forceLoadLargeDiff = useDiffViewStore((s) => s.forceLoadLargeDiff)

  useEffect(() => {
    loadRepos()
  }, [loadRepos])
  useEffect(() => {
    refresh()
  }, [selectedRepo, refresh])
  useEffect(() => {
    loadDiff()
  }, [selectedRepo, selectedFile, loadDiff])

  useVisibilityAwareInterval(refresh, POLL_GIT_STATUS_INTERVAL)

  useEffect(() => {
    const handler = (): void => {
      refresh()
      loadDiff()
    }
    window.addEventListener('bde:refresh', handler)
    return () => window.removeEventListener('bde:refresh', handler)
  }, [refresh, loadDiff])

  const repoNames = Object.keys(repos)
  const stagedCount = files.filter((f) => stagedSet.has(f.path)).length

  return (
    <div className="diff-view">
      <div className="diff-view__header">
        <div className="diff-view__repos">
          {repoNames.map((name) => (
            <button
              key={name}
              className={`diff-view__chip ${selectedRepo === name ? 'diff-view__chip--active' : ''}`}
              onClick={() => selectRepo(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="diff-view__meta">
          {branches.length > 0 && (
            <select
              className="git-branch-select"
              value={currentBranch}
              onChange={(e) => switchBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="icon"
            size="sm"
            onClick={() => {
              refresh()
              loadDiff()
            }}
            disabled={loading}
            title="Refresh"
          >
            &#x21bb;
          </Button>
        </div>
      </div>

      <ErrorBanner message={error} className="diff-view__error" />
      {pushOutput && (
        <div className="git-push-output">
          <pre>{pushOutput}</pre>
          <button className="git-push-output__close" onClick={() => setPushOutput(null)}>
            &times;
          </button>
        </div>
      )}

      {loading && files.length === 0 ? (
        <div className="diff-view__loading">
          <div className="diff-view__loading-grid">
            <div className="bde-skeleton diff-view__loading-sidebar" />
            <div className="bde-skeleton diff-view__loading-content" />
          </div>
        </div>
      ) : (
        <div className="git-client">
          <div className="git-sidebar">
            <div className="git-sidebar__header">
              <span className="git-sidebar__title">Changes</span>
              <span className="git-sidebar__count bde-count-badge">{files.length}</span>
            </div>

            <div className="git-sidebar__actions">
              <button
                className="git-sidebar__action"
                onClick={() => stageAll()}
                title="Stage all"
              >
                Stage All
              </button>
              {stagedCount > 0 && (
                <button
                  className="git-sidebar__action"
                  onClick={() => unstageAll()}
                  title="Unstage all"
                >
                  Unstage All
                </button>
              )}
            </div>

            <div className="git-sidebar__list">
              {files.map((f) => {
                const isStaged = stagedSet.has(f.path)
                return (
                  <div
                    key={f.path}
                    className={`git-file-item ${selectedFile === f.path ? 'git-file-item--active' : ''}`}
                  >
                    <label
                      className="git-file-item__checkbox"
                      title={isStaged ? 'Unstage' : 'Stage'}
                    >
                      <input
                        type="checkbox"
                        checked={isStaged}
                        onChange={() => toggleStage(f.path)}
                      />
                    </label>
                    <button
                      className="git-file-item__name"
                      onClick={() =>
                        setSelectedFile(selectedFile === f.path ? null : f.path)
                      }
                    >
                      {f.path.split('/').pop()}
                    </button>
                    <span
                      className={`git-file-item__status git-file-item__status--${f.status.toLowerCase()}`}
                      title={statusLabel(f.status)}
                    >
                      {f.status}
                    </span>
                  </div>
                )
              })}
              {files.length === 0 && (
                <EmptyState
                  icon={<GitBranch size={24} />}
                  title="Working tree clean"
                  description="No uncommitted changes"
                />
              )}
            </div>

            <div className="git-commit-panel">
              <textarea
                className="git-commit-panel__input"
                placeholder="Commit message..."
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    e.preventDefault()
                    commit()
                  }
                }}
              />
              <div className="git-commit-panel__actions">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => commit()}
                  disabled={!commitMsg.trim() || stagedCount === 0 || committing}
                  loading={committing}
                >
                  Commit ({stagedCount})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => push()}
                  disabled={pushing}
                  loading={pushing}
                >
                  Push
                </Button>
              </div>
            </div>
          </div>

          <div className="git-diff-pane">
            {selectedFile && (
              <div className="git-diff-pane__file-header">
                <span className="git-diff-pane__file-path">{selectedFile}</span>
              </div>
            )}
            {diffSizeWarning ? (
              <DiffSizeWarning
                sizeBytes={diffSizeWarning}
                onLoadAnyway={() => forceLoadLargeDiff()}
              />
            ) : (
              <DiffViewer files={diffFiles} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DiffView
