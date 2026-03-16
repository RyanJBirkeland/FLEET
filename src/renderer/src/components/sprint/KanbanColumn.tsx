import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskCard } from './TaskCard'
import { AddCardForm } from './AddCardForm'
import { EmptyState } from '../ui/EmptyState'
import type { SprintTask } from './SprintCenter'

type KanbanColumnProps = {
  status: SprintTask['status']
  label: string
  tasks: SprintTask[]
  onLaunch: (task: SprintTask) => void
  onViewSpec: (task: SprintTask) => void
  onViewOutput: (task: SprintTask) => void
  onAddCard?: (data: { title: string; repo: string; description: string }) => void
}

const EMPTY_LABELS: Record<SprintTask['status'], string> = {
  backlog: 'Backlog is empty',
  active: 'Nothing in progress',
  done: 'No completed tasks yet',
}

export function KanbanColumn({
  status,
  label,
  tasks,
  onLaunch,
  onViewSpec,
  onViewOutput,
  onAddCard,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status })
  const ids = tasks.map((t) => t.id)

  return (
    <div
      ref={setNodeRef}
      className={`kanban-col ${isOver ? 'kanban-col--drop-target' : ''}`}
    >
      <div className="kanban-col__header">
        {label}
        <span className="sprint-col__count bde-count-badge">{tasks.length}</span>
      </div>
      <div className="kanban-col__cards">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <EmptyState title={EMPTY_LABELS[status]} />
          ) : (
            tasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                onLaunch={onLaunch}
                onViewSpec={onViewSpec}
                onViewOutput={onViewOutput}
              />
            ))
          )}
        </SortableContext>
        {status === 'backlog' && onAddCard && <AddCardForm onSubmit={onAddCard} />}
      </div>
    </div>
  )
}
