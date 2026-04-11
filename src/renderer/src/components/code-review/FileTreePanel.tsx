import './FileTreePanel.css'
import { useState } from 'react'
import { useCodeReviewStore } from '../../stores/codeReview'
import { useReviewPartnerStore } from '../../stores/reviewPartner'
import { Plus, Minus, Edit2, ChevronRight } from 'lucide-react'
import { AIFileStatusBadge, type FileReviewStatus } from './AIFileStatusBadge'

export function FileTreePanel(): React.JSX.Element {
  const diffFiles = useCodeReviewStore((s) => s.diffFiles)
  const selectedDiffFile = useCodeReviewStore((s) => s.selectedDiffFile)
  const setSelectedDiffFile = useCodeReviewStore((s) => s.setSelectedDiffFile)
  const selectedTaskId = useCodeReviewStore((s) => s.selectedTaskId)
  const reviewResult = useReviewPartnerStore((s) =>
    selectedTaskId ? s.reviewByTask[selectedTaskId]?.result : undefined
  )
  const [isExpanded, setIsExpanded] = useState(false)

  function statusForPath(path: string): FileReviewStatus {
    const finding = reviewResult?.findings.perFile.find((f) => f.path === path)
    if (!finding) return 'unreviewed'
    return finding.status
  }

  const statusIcon = (status: string): React.JSX.Element => {
    if (status === 'A' || status === 'added') return <Plus size={12} className="cr-file-added" />
    if (status === 'D' || status === 'deleted')
      return <Minus size={12} className="cr-file-deleted" />
    return <Edit2 size={12} className="cr-file-modified" />
  }

  const rootClass = isExpanded ? 'cr-filetree cr-filetree--expanded' : 'cr-filetree'

  return (
    <aside className={rootClass} aria-label="Changed files" aria-expanded={isExpanded}>
      {!isExpanded && (
        <button
          className="cr-filetree__expand-btn"
          onClick={() => setIsExpanded(true)}
          aria-label="Expand file tree"
        >
          <ChevronRight size={16} />
        </button>
      )}
      <header className="cr-filetree__header">
        <span className="cr-filetree__label">Files</span>
        <span className="cr-filetree__count">{diffFiles.length}</span>
        {isExpanded && (
          <button
            className="cr-filetree__collapse-btn"
            onClick={() => setIsExpanded(false)}
            aria-label="Collapse file tree"
          >
            ×
          </button>
        )}
      </header>
      <div className="cr-filetree__list">
        {diffFiles.map((file) => {
          const isSelected = file.path === selectedDiffFile
          return (
            <button
              key={file.path}
              className={`cr-filetree__row${isSelected ? ' cr-filetree__row--selected' : ''}`}
              onClick={() => setSelectedDiffFile(file.path)}
              data-testid={`filetree-row-${file.path}`}
            >
              {statusIcon(file.status)}
              <span className="cr-filetree__filename">{file.path}</span>
              <AIFileStatusBadge status={statusForPath(file.path)} />
              <span className="cr-filetree__stats">
                +{file.additions} −{file.deletions}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
