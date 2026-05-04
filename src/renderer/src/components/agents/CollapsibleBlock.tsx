import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import './CollapsibleBlock.css'

interface CollapsibleBlockProps {
  header: React.ReactNode
  expandedContent: React.ReactNode
  searchClass?: string | undefined
  testId?: string | undefined
  /** When provided, the expand/collapse button aria-label includes this context (e.g. the tool name). */
  label?: string | undefined
}

export function CollapsibleBlock({
  header,
  expandedContent,
  searchClass = '',
  testId,
  label
}: CollapsibleBlockProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const expandLabel = label ? `${expanded ? 'Collapse' : 'Expand'} ${label}` : expanded ? 'Collapse' : 'Expand'

  return (
    <div
      className={`console-line console-line--collapsible${expanded ? ' console-line--expanded' : ''}${searchClass}`}
      data-testid={testId}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="console-collapsible-button"
        aria-label={expandLabel}
      >
        <ChevronRight
          size={14}
          className="console-line__chevron"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}
        />
        {header}
      </button>
      {expanded && expandedContent}
    </div>
  )
}
