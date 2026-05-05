/**
 * Compact inline card for playground previews in agent chat.
 * Appears when agent writes HTML, SVG, Markdown, or JSON files. Click to open PlaygroundModal.
 */
import { FileCode, Eye } from 'lucide-react'
import './PlaygroundCard.css'
import type { PlaygroundContentType } from '../../../../shared/types'

const CONTENT_TYPE_LABELS: Record<PlaygroundContentType, string> = {
  html: 'HTML',
  svg: 'SVG',
  markdown: 'Markdown',
  json: 'JSON'
}

export interface PlaygroundCardProps {
  /** Original filename */
  filename: string
  /** File size in bytes */
  sizeBytes: number
  /** Content type for display */
  contentType: PlaygroundContentType
  /** Click handler to open modal */
  onClick: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PlaygroundCard({
  filename,
  sizeBytes,
  contentType,
  onClick
}: PlaygroundCardProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-label={`Preview ${filename}`}
      data-testid="playground-card"
      className="playground-card"
    >
      <div className="playground-card__icon-box">
        <FileCode size={20} className="playground-card__icon" />
      </div>

      <div className="playground-card__content">
        <div className="playground-card__filename-row">
          <div
            className="playground-card__filename"
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {filename}
          </div>
          <span className="playground-card__content-type-badge">
            {CONTENT_TYPE_LABELS[contentType]}
          </span>
        </div>
        <div className="playground-card__filesize">{formatFileSize(sizeBytes)}</div>
      </div>

      <div className="playground-card__preview-hint">
        <Eye size={12} />
        <span>Preview</span>
      </div>
    </button>
  )
}
