import { useState } from 'react'
import { buildSyntheticDiff } from '../../lib/spec-diff'
import { parseDiff } from '../../lib/diff-parser'
import type { DiffLine } from '../../lib/diff-parser'
import './SpecDiffViewer.css'

interface SpecDiffViewerProps {
  oldSpec: string | null
  newSpec: string
}

export function SpecDiffViewer({ oldSpec, newSpec }: SpecDiffViewerProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const addCount = newSpec.split('\n').length
  const delCount = oldSpec ? oldSpec.split('\n').length : 0
  const summaryLabel = `Show changes (+${addCount} / -${delCount})`

  if (!expanded) {
    return (
      <button
        type="button"
        className="spec-diff-viewer__toggle"
        onClick={() => setExpanded(true)}
        aria-label="Show changes"
      >
        {summaryLabel}
      </button>
    )
  }

  const raw = buildSyntheticDiff('spec.md', oldSpec ?? '', newSpec)
  const files = parseDiff(raw)
  const showDelLines = oldSpec !== null

  return (
    <div className="spec-diff-viewer">
      <button
        type="button"
        className="spec-diff-viewer__toggle"
        onClick={() => setExpanded(false)}
        aria-label="Hide changes"
      >
        Hide changes
      </button>
      <div className="spec-diff-viewer__lines" data-testid="spec-diff-lines">
        {files.map((file, fi) =>
          file.hunks.map((hunk, hi) =>
            hunk.lines
              .filter((line) => showDelLines || line.type !== 'del')
              .map((line: DiffLine, li) => {
                const rowClass =
                  line.type === 'add'
                    ? 'edit-diff-card__row--add'
                    : line.type === 'del'
                      ? 'edit-diff-card__row--del'
                      : 'edit-diff-card__row--ctx'
                return (
                  <div key={`${fi}-${hi}-${li}`} className={`edit-diff-card__row ${rowClass}`}>
                    <span className="edit-diff-card__content">{line.content}</span>
                  </div>
                )
              })
          )
        )}
      </div>
    </div>
  )
}
