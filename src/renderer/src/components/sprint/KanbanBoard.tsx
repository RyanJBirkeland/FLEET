import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import type { SprintTask } from './SprintCenter'

type KanbanBoardProps = {
  tasks: SprintTask[]
  onDragEnd: (taskId: string, newStatus: SprintTask['status']) => void
  onLaunch: (task: SprintTask) => void
  onViewSpec: (task: SprintTask) => void
  onViewOutput: (task: SprintTask) => void
  onAddCard: (data: { title: string; repo: string; description: string }) => void
}

export function KanbanBoard({
  tasks,
  onDragEnd,
  onLaunch,
  onViewSpec,
  onViewOutput,
  onAddCard,
}: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const backlog = tasks.filter((t) => t.status === 'backlog')
  const active = tasks.filter((t) => t.status === 'active')
  const done = tasks.filter((t) => t.status === 'done')

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const taskId = String(active.id)
    const destinationStatus = String(over.id) as SprintTask['status']
    if (['backlog', 'active', 'done'].includes(destinationStatus)) {
      onDragEnd(taskId, destinationStatus)
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        <KanbanColumn
          status="backlog"
          label="Backlog"
          tasks={backlog}
          onLaunch={onLaunch}
          onViewSpec={onViewSpec}
          onViewOutput={onViewOutput}
          onAddCard={onAddCard}
        />
        <KanbanColumn
          status="active"
          label="In Progress"
          tasks={active}
          onLaunch={onLaunch}
          onViewSpec={onViewSpec}
          onViewOutput={onViewOutput}
        />
        <KanbanColumn
          status="done"
          label="Done"
          tasks={done}
          onLaunch={onLaunch}
          onViewSpec={onViewSpec}
          onViewOutput={onViewOutput}
        />
      </div>
    </DndContext>
  )
}
