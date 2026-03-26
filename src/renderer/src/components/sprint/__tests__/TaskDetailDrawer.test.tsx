import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SprintTask } from '../../../../../shared/types'
import { TaskDetailDrawer } from '../TaskDetailDrawer'

const baseTask: SprintTask = {
  id: 'task-1',
  title: 'Implement login flow',
  repo: 'BDE',
  prompt: 'Build the login page with OAuth support',
  priority: 2,
  status: 'queued',
  notes: null,
  spec: null,
  retry_count: 0,
  fast_fail_count: 0,
  agent_run_id: null,
  pr_number: null,
  pr_status: null,
  pr_url: null,
  claimed_by: null,
  started_at: null,
  completed_at: null,
  template_name: null,
  depends_on: null,
  updated_at: '2026-03-01T00:00:00Z',
  created_at: '2026-03-01T00:00:00Z'
}

function makeProps(overrides: Partial<Parameters<typeof TaskDetailDrawer>[0]> = {}) {
  return {
    task: baseTask,
    onClose: vi.fn(),
    onLaunch: vi.fn(),
    onStop: vi.fn(),
    onMarkDone: vi.fn(),
    onRerun: vi.fn(),
    onDelete: vi.fn(),
    onViewLogs: vi.fn(),
    onOpenSpec: vi.fn(),
    onEdit: vi.fn(),
    onViewAgents: vi.fn(),
    ...overrides
  }
}

describe('TaskDetailDrawer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders task title', () => {
    render(<TaskDetailDrawer {...makeProps()} />)
    expect(screen.getByText('Implement login flow')).toBeInTheDocument()
  })

  it('shows prompt in monospace block', () => {
    render(<TaskDetailDrawer {...makeProps()} />)
    const prompt = screen.getByText('Build the login page with OAuth support')
    expect(prompt.closest('.task-drawer__prompt')).toBeTruthy()
  })

  it('shows "View Spec →" link when task.spec exists', () => {
    const task: SprintTask = { ...baseTask, spec: '# Login Spec\nDetails here' }
    render(<TaskDetailDrawer {...makeProps({ task })} />)
    expect(screen.getByText('View Spec →')).toBeInTheDocument()
  })

  it('does NOT show spec link when task.spec is null', () => {
    render(<TaskDetailDrawer {...makeProps()} />)
    expect(screen.queryByText('View Spec →')).not.toBeInTheDocument()
  })

  it('shows correct action buttons for queued status (Launch, Edit, Delete)', () => {
    render(<TaskDetailDrawer {...makeProps()} />)
    expect(screen.getByText('Launch')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('shows correct action buttons for active status (View Logs, Edit, Stop)', () => {
    const task: SprintTask = {
      ...baseTask,
      status: 'active',
      started_at: '2026-03-01T11:00:00Z'
    }
    render(<TaskDetailDrawer {...makeProps({ task })} />)
    expect(screen.getByText('View Logs')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Stop')).toBeInTheDocument()
  })

  it('shows correct action buttons for failed status (Re-run, Edit, Delete)', () => {
    const task: SprintTask = { ...baseTask, status: 'failed' }
    render(<TaskDetailDrawer {...makeProps({ task })} />)
    expect(screen.getByText('Re-run')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onLaunch when Launch button clicked', () => {
    const props = makeProps()
    render(<TaskDetailDrawer {...props} />)
    fireEvent.click(screen.getByText('Launch'))
    expect(props.onLaunch).toHaveBeenCalledWith(baseTask)
  })

  it('calls onStop when Stop button clicked', () => {
    const task: SprintTask = {
      ...baseTask,
      status: 'active',
      started_at: '2026-03-01T11:00:00Z'
    }
    const props = makeProps({ task })
    render(<TaskDetailDrawer {...props} />)
    fireEvent.click(screen.getByText('Stop'))
    expect(props.onStop).toHaveBeenCalledWith(task)
  })

  it('calls onOpenSpec when "View Spec →" clicked', () => {
    const task: SprintTask = { ...baseTask, spec: '# Spec content' }
    const props = makeProps({ task })
    render(<TaskDetailDrawer {...props} />)
    fireEvent.click(screen.getByText('View Spec →'))
    expect(props.onOpenSpec).toHaveBeenCalled()
  })

  it('shows agent link when agent_run_id exists', () => {
    const task: SprintTask = {
      ...baseTask,
      status: 'active',
      agent_run_id: 'agent-42',
      started_at: '2026-03-01T11:00:00Z'
    }
    render(<TaskDetailDrawer {...makeProps({ task })} />)
    expect(screen.getByText(/View in Agents/)).toBeInTheDocument()
  })
})
