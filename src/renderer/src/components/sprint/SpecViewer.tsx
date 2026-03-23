import { renderMarkdown } from '../../lib/render-markdown'
import { EmptyState } from '../ui/EmptyState'

type SpecViewerProps = {
  content: string
  onEdit: () => void
}

export function SpecViewer({ content, onEdit }: SpecViewerProps) {
  if (!content) {
    return (
      <EmptyState
        title="No spec yet"
        description="Write a spec to guide the agent"
        action={{ label: 'Write Spec', onClick: onEdit }}
      />
    )
  }

  const html = renderMarkdown(content)

  return (
    <div
      className="spec-drawer__rendered"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
