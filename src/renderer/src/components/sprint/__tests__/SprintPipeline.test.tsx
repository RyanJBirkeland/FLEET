import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { SprintTask } from '../../../../../shared/types'

// vi.hoisted ensures these refs are available inside vi.mock factory functions
const mocks = vi.hoisted(() => {
  const mockLoadData = vi.fn()
  const mockUpdateTask = vi.fn()
  const mockCreateTask = vi.fn()
  const mockSetSelectedTaskId = vi.fn()
  const mockSetDrawerOpen = vi.fn()
  const mockSetSpecPanelOpen = vi.fn()
  const mockSetDoneViewOpen = vi.fn()
  const mockSetView = vi.fn()

  const storeState = {
    tasks: [] as SprintTask[],
    loading: false,
    loadError: null as string | null,
    loadData: mockLoadData,
    updateTask: mockUpdateTask,
    createTask: mockCreateTask
  }

  const uiState = {
    selectedTaskId: null as string | null,
    drawerOpen: false,
    specPanelOpen: false,
    doneViewOpen: false,
    logDrawerTaskId: null as string | null,
    setSelectedTaskId: mockSetSelectedTaskId,
    setDrawerOpen: mockSetDrawerOpen,
    setSpecPanelOpen: mockSetSpecPanelOpen,
    setDoneViewOpen: mockSetDoneViewOpen,
    setLogDrawerTaskId: vi.fn()
  }

  return {
    mockLoadData,
    mockUpdateTask,
    mockCreateTask,
    mockSetSelectedTaskId,
    mockSetDrawerOpen,
    mockSetSpecPanelOpen,
    mockSetDoneViewOpen,
    mockSetView,
    storeState,
    uiState
  }
})

// Mock framer-motion
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LayoutGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout-group">{children}</div>
  ),
  motion: {
    div: ({ children, className, ...rest }: any) => (
      <div className={className} {...rest}>
        {children}
      </div>
    )
  }
}))

// Mock stores
vi.mock('../../../stores/sprintTasks', () => ({
  useSprintTasks: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mocks.storeState)
    }
    return mocks.storeState
  })
}))

vi.mock('../../../stores/sprintUI', () => ({
  useSprintUI: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mocks.uiState)
    }
    return undefined
  })
}))

vi.mock('../../../stores/ui', () => ({
  useUIStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector({ setView: mocks.mockSetView })
    }
    return mocks.mockSetView
  })
}))

vi.mock('../../../stores/sprintEvents', () => ({
  useSprintEvents: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector({ initTaskOutputListener: () => () => {} })
    }
    return () => () => {}
  })
}))

// Mock hooks as no-ops
vi.mock('../../../hooks/useTaskNotifications', () => ({
  setOpenLogDrawerTaskId: vi.fn(),
  useTaskToasts: vi.fn()
}))

vi.mock('../../../hooks/useSprintPolling', () => ({ useSprintPolling: vi.fn() }))
vi.mock('../../../hooks/usePrStatusPolling', () => ({ usePrStatusPolling: vi.fn() }))
vi.mock('../../../hooks/useSprintKeyboardShortcuts', () => ({
  useSprintKeyboardShortcuts: vi.fn()
}))

vi.mock('../../../hooks/useSprintTaskActions', () => ({
  useSprintTaskActions: () => ({
    handleSaveSpec: vi.fn(),
    handleMarkDone: vi.fn(),
    handleStop: vi.fn(),
    handleRerun: vi.fn(),
    launchTask: vi.fn(),
    deleteTask: vi.fn(),
    confirmProps: { open: false, title: '', message: '', onConfirm: vi.fn(), onCancel: vi.fn() }
  })
}))

vi.mock('../../../hooks/useHealthCheck', () => ({
  useHealthCheck: vi.fn(() => ({
    visibleStuckTasks: [],
    dismissTask: vi.fn()
  }))
}))

// Mock child components
vi.mock('../PipelineBacklog', () => ({
  PipelineBacklog: () => <div data-testid="pipeline-backlog">PipelineBacklog</div>
}))

vi.mock('../PipelineStage', () => ({
  PipelineStage: ({ name, label }: { name: string; label: string }) => (
    <div data-testid={`pipeline-stage-${name}`}>{label}</div>
  )
}))

vi.mock('../TaskDetailDrawer', () => ({
  TaskDetailDrawer: ({ task }: { task: SprintTask }) => (
    <div data-testid="task-detail-drawer">Drawer: {task.title}</div>
  )
}))

vi.mock('../SpecPanel', () => ({
  SpecPanel: ({ taskTitle }: { taskTitle: string }) => (
    <div data-testid="spec-panel">Spec: {taskTitle}</div>
  )
}))

vi.mock('../DoneHistoryPanel', () => ({
  DoneHistoryPanel: () => <div data-testid="done-history-panel">DoneHistoryPanel</div>
}))

vi.mock('../NewTicketModal', () => ({
  NewTicketModal: () => <div data-testid="new-ticket-modal">NewTicketModal</div>
}))

vi.mock('../../ui/ConfirmModal', () => ({
  ConfirmModal: () => <div data-testid="confirm-modal">ConfirmModal</div>
}))

function makeTask(overrides: Partial<SprintTask> = {}): SprintTask {
  return {
    id: crypto.randomUUID(),
    title: 'Test task',
    repo: 'BDE',
    prompt: null,
    priority: 1,
    status: 'backlog',
    notes: null,
    spec: null,
    agent_run_id: null,
    pr_number: null,
    pr_status: null,
    pr_mergeable_state: null,
    pr_url: null,
    claimed_by: null,
    started_at: null,
    completed_at: null,
    retry_count: 0,
    fast_fail_count: 0,
    template_name: null,
    depends_on: null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides
  }
}

describe('SprintPipeline', () => {
  beforeEach(() => {
    Object.assign(mocks.storeState, {
      tasks: [],
      loading: false,
      loadError: null,
      loadData: mocks.mockLoadData,
      updateTask: mocks.mockUpdateTask,
      createTask: mocks.mockCreateTask
    })
    Object.assign(mocks.uiState, {
      selectedTaskId: null,
      drawerOpen: false,
      specPanelOpen: false,
      doneViewOpen: false,
      logDrawerTaskId: null,
      setSelectedTaskId: mocks.mockSetSelectedTaskId,
      setDrawerOpen: mocks.mockSetDrawerOpen,
      setSpecPanelOpen: mocks.mockSetSpecPanelOpen,
      setDoneViewOpen: mocks.mockSetDoneViewOpen
    })
  })

  it('renders pipeline header with "Sprint" title', async () => {
    const { SprintPipeline } = await import('../SprintPipeline')
    render(<SprintPipeline />)
    expect(screen.getByText('Sprint')).toBeInTheDocument()
  })

  it('renders 5 pipeline stages (queued, blocked, active, review, done)', async () => {
    const { SprintPipeline } = await import('../SprintPipeline')
    render(<SprintPipeline />)
    expect(screen.getByTestId('pipeline-stage-queued')).toBeInTheDocument()
    expect(screen.getByTestId('pipeline-stage-blocked')).toBeInTheDocument()
    expect(screen.getByTestId('pipeline-stage-active')).toBeInTheDocument()
    expect(screen.getByTestId('pipeline-stage-review')).toBeInTheDocument()
    expect(screen.getByTestId('pipeline-stage-done')).toBeInTheDocument()
  })

  it('renders PipelineBacklog sidebar', async () => {
    const { SprintPipeline } = await import('../SprintPipeline')
    render(<SprintPipeline />)
    expect(screen.getByTestId('pipeline-backlog')).toBeInTheDocument()
  })

  it('shows TaskDetailDrawer when a task is selected', async () => {
    const task = makeTask({ id: 'sel-1', title: 'Selected Task', status: 'active' })
    Object.assign(mocks.storeState, { tasks: [task] })
    Object.assign(mocks.uiState, { selectedTaskId: 'sel-1', drawerOpen: true })

    const { SprintPipeline } = await import('../SprintPipeline')
    render(<SprintPipeline />)
    expect(screen.getByTestId('task-detail-drawer')).toBeInTheDocument()
    expect(screen.getByText('Drawer: Selected Task')).toBeInTheDocument()
  })

  it('does not show drawer when no task selected', async () => {
    const { SprintPipeline } = await import('../SprintPipeline')
    render(<SprintPipeline />)
    expect(screen.queryByTestId('task-detail-drawer')).not.toBeInTheDocument()
  })

  it('shows SpecPanel when specPanelOpen is true', async () => {
    const task = makeTask({ id: 'spec-1', title: 'Spec Task', spec: 'some spec content' })
    Object.assign(mocks.storeState, { tasks: [task] })
    Object.assign(mocks.uiState, { selectedTaskId: 'spec-1', specPanelOpen: true })

    const { SprintPipeline } = await import('../SprintPipeline')
    render(<SprintPipeline />)
    expect(screen.getByTestId('spec-panel')).toBeInTheDocument()
  })

  it('shows DoneHistoryPanel when doneViewOpen is true', async () => {
    Object.assign(mocks.uiState, { doneViewOpen: true })

    const { SprintPipeline } = await import('../SprintPipeline')
    render(<SprintPipeline />)
    expect(screen.getByTestId('done-history-panel')).toBeInTheDocument()
  })

  it('renders "+ New Task" button', async () => {
    const { SprintPipeline } = await import('../SprintPipeline')
    render(<SprintPipeline />)
    expect(screen.getByText('+ New Task')).toBeInTheDocument()
  })

  it('wraps pipeline stages in LayoutGroup', async () => {
    const { SprintPipeline } = await import('../SprintPipeline')
    render(<SprintPipeline />)
    expect(screen.getByTestId('layout-group')).toBeInTheDocument()
  })
})
