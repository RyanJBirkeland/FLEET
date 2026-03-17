import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { SprintTask } from '../../../../../shared/types'

// Capture DndContext's onDragEnd so we can invoke it manually
let capturedOnDragEnd: ((event: unknown) => void) | null = null

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode
    onDragEnd: (e: unknown) => void
  }) => {
    capturedOnDragEnd = onDragEnd
    return <div data-testid="dnd-context">{children}</div>
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) =>
    children ? <div data-testid="drag-overlay">{children}</div> : null,
  useDroppable: () => ({ isOver: false, setNodeRef: () => {} }),
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: vi.fn(
    <T,>(arr: T[], from: number, to: number): T[] => {
      const copy = [...arr]
      const [item] = copy.splice(from, 1)
      copy.splice(to, 0, item)
      return copy
    }
  ),
}))

function makeTask(overrides: Partial<SprintTask> = {}): SprintTask {
  return {
    id: crypto.randomUUID(),
    title: 'Test task',
    repo: 'BDE',
    prompt: null,
    priority: 1,
    status: 'backlog',
    description: null,
    spec: null,
    agent_run_id: null,
    pr_number: null,
    pr_status: null,
    pr_url: null,
    column_order: 0,
    started_at: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// Import after mocks are set up
import { KanbanBoard } from '../KanbanBoard'

describe('KanbanBoard', () => {
  const defaultProps = {
    tasks: [] as SprintTask[],
    prMergedMap: {} as Record<string, boolean>,
    onDragEnd: vi.fn(),
    onReorder: vi.fn(),
    onPushToSprint: vi.fn(),
    onLaunch: vi.fn(),
    onViewSpec: vi.fn(),
    onViewOutput: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnDragEnd = null
  })

  it('renders 4 columns (Backlog, Sprint, In Progress, Done)', () => {
    render(<KanbanBoard {...defaultProps} />)
    expect(screen.getByText('Backlog')).toBeInTheDocument()
    expect(screen.getByText('Sprint')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('distributes tasks to correct columns by status', () => {
    const tasks = [
      makeTask({ title: 'Backlog item', status: 'backlog' }),
      makeTask({ title: 'Queued item', status: 'queued' }),
      makeTask({ title: 'Active item', status: 'active' }),
      makeTask({ title: 'Done item', status: 'done' }),
    ]

    render(<KanbanBoard {...defaultProps} tasks={tasks} />)

    expect(screen.getByText('Backlog item')).toBeInTheDocument()
    expect(screen.getByText('Queued item')).toBeInTheDocument()
    expect(screen.getByText('Active item')).toBeInTheDocument()
    expect(screen.getByText('Done item')).toBeInTheDocument()
  })

  it('renders empty columns with empty-state message', () => {
    render(<KanbanBoard {...defaultProps} />)
    expect(screen.getByText('Backlog is empty')).toBeInTheDocument()
    expect(screen.getByText('Sprint queue is empty')).toBeInTheDocument()
    expect(screen.getByText('Nothing in progress')).toBeInTheDocument()
    expect(screen.getByText('No completed tasks yet')).toBeInTheDocument()
  })

  it('shows correct task count per column', () => {
    const tasks = [
      makeTask({ title: 'B1', status: 'backlog' }),
      makeTask({ title: 'B2', status: 'backlog' }),
      makeTask({ title: 'D1', status: 'done' }),
    ]

    render(<KanbanBoard {...defaultProps} tasks={tasks} />)

    const counts = screen.getAllByText(/^[0-4]$/)
    const countValues = counts.map((el) => el.textContent)
    expect(countValues).toContain('2') // backlog
    expect(countValues).toContain('1') // done
  })

  it('calls onDragEnd with correct args when task is dragged to another column', () => {
    const task = makeTask({ id: 'task-1', title: 'Drag me', status: 'backlog' })
    render(<KanbanBoard {...defaultProps} tasks={[task]} />)

    capturedOnDragEnd?.({
      active: { id: 'task-1' },
      over: { id: 'done' },
    })

    expect(defaultProps.onDragEnd).toHaveBeenCalledWith('task-1', 'done')
  })

  it('does not call onDragEnd when dropped on same column status', () => {
    const task = makeTask({ id: 'task-1', status: 'backlog' })
    render(<KanbanBoard {...defaultProps} tasks={[task]} />)

    capturedOnDragEnd?.({
      active: { id: 'task-1' },
      over: { id: 'backlog' },
    })

    expect(defaultProps.onDragEnd).not.toHaveBeenCalled()
  })

  it('does not call onDragEnd when dropped on nothing', () => {
    const task = makeTask({ id: 'task-1', status: 'backlog' })
    render(<KanbanBoard {...defaultProps} tasks={[task]} />)

    capturedOnDragEnd?.({
      active: { id: 'task-1' },
      over: null,
    })

    expect(defaultProps.onDragEnd).not.toHaveBeenCalled()
  })
})
