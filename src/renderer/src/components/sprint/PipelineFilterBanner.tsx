import { X } from 'lucide-react'
import { useSprintUI } from '../../stores/sprintUI'
import type { SprintTask } from '../../../../shared/types'
import './PipelineFilterBanner.css'

interface PipelineFilterBannerProps {
  filteredTasks: SprintTask[]
  totalTasks: SprintTask[]
}

export function PipelineFilterBanner({
  filteredTasks,
  totalTasks
}: PipelineFilterBannerProps): React.JSX.Element | null {
  const statusFilter = useSprintUI((s) => s.statusFilter)
  const repoFilter = useSprintUI((s) => s.repoFilter)
  const tagFilter = useSprintUI((s) => s.tagFilter)
  const searchQuery = useSprintUI((s) => s.searchQuery)
  const clearAllFilters = useSprintUI((s) => s.clearAllFilters)

  // Only show when at least one filter is active
  const hasActiveFilters =
    statusFilter !== 'all' || repoFilter !== null || tagFilter !== null || searchQuery !== ''

  if (!hasActiveFilters) return null

  const filteredCount = filteredTasks.length
  const totalCount = totalTasks.length

  return (
    <div className="pipeline-filter-banner">
      <div className="pipeline-filter-banner__content">
        <span className="pipeline-filter-banner__count">
          Showing {filteredCount} of {totalCount} tasks
        </span>
        <div className="pipeline-filter-banner__chips">
          {statusFilter !== 'all' && (
            <span className="pipeline-filter-banner__chip">status: {statusFilter}</span>
          )}
          {repoFilter && <span className="pipeline-filter-banner__chip">repo: {repoFilter}</span>}
          {tagFilter && <span className="pipeline-filter-banner__chip">tag: {tagFilter}</span>}
          {searchQuery && (
            <span className="pipeline-filter-banner__chip">search: &quot;{searchQuery}&quot;</span>
          )}
        </div>
      </div>
      <button
        className="pipeline-filter-banner__clear"
        onClick={clearAllFilters}
        aria-label="Clear all filters"
      >
        <X size={14} />
        Clear all filters
      </button>
    </div>
  )
}
