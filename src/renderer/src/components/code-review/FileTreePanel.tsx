import './FileTreePanel.css'
import { useCodeReviewStore } from '../../stores/codeReview'
import { Plus, Minus, Edit2 } from 'lucide-react'

export function FileTreePanel(): React.JSX.Element {
  const diffFiles = useCodeReviewStore((s) => s.diffFiles)
  const selectedDiffFile = useCodeReviewStore((s) => s.selectedDiffFile)
  const setSelectedDiffFile = useCodeReviewStore((s) => s.setSelectedDiffFile)

  const statusIcon = (status: string): React.JSX.Element => {
    if (status === 'A' || status === 'added') return <Plus size={12} className="cr-file-added" />
    if (status === 'D' || status === 'deleted')
      return <Minus size={12} className="cr-file-deleted" />
    return <Edit2 size={12} className="cr-file-modified" />
  }

  return (
    <aside className="cr-filetree" aria-label="Changed files">
      <header className="cr-filetree__header">
        <span className="cr-filetree__label">Files</span>
        <span className="cr-filetree__count">{diffFiles.length}</span>
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
