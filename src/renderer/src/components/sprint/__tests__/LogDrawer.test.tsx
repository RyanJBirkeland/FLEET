import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SprintTask } from '../../../../../shared/types'

vi.mock('../AgentLogViewer', () => ({
  AgentLogViewer: ({ logContent }: { logContent: string }) => (
    <div data-testid="agent-log-viewer">Log: {logContent.length} chars</div>
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

import { LogDrawer } from '../LogDrawer'

describe('LogDrawer', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when task is null', () => {
    const { container } = render(<LogDrawer task={null} onClose={onClose} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders drawer when task is provided', () => {
    const task = makeTask({ agent_run_id: 'abc12345-full-id' })
    render(<LogDrawer task={task} onClose={onClose} />)

    expect(screen.getByText('agent/abc12345')).toBeInTheDocument()
    expect(screen.getByText('BDE')).toBeInTheDocument()
  })

  it('shows empty state when task has no agent_run_id', () => {
    const task = makeTask({ agent_run_id: null })
    render(<LogDrawer task={task} onClose={onClose} />)

    expect(screen.getByText('No agent session linked to this task.')).toBeInTheDocument()
  })

  it('shows AgentLogViewer when log content is fetched', async () => {
    vi.mocked(window.api.sprint.readLog).mockResolvedValue({
      content: '{"type":"assistant","message":{"content":[{"type":"text","text":"hello"}]}}',
      status: 'done',
    })

    const task = makeTask({ agent_run_id: 'run-123' })
    render(<LogDrawer task={task} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByTestId('agent-log-viewer')).toBeInTheDocument()
    })
  })

  it('shows starting state when log content is empty', async () => {
    vi.mocked(window.api.sprint.readLog).mockResolvedValue({
      content: '',
      status: 'running',
    })

    const task = makeTask({ agent_run_id: 'run-empty' })
    render(<LogDrawer task={task} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Agent is starting up...')).toBeInTheDocument()
    })
  })

  it('fetches log content on mount when agent_run_id exists', async () => {
    const readLog = vi.mocked(window.api.sprint.readLog)
    readLog.mockResolvedValue({ content: 'log data', status: 'done' })

    const task = makeTask({ agent_run_id: 'run-456' })
    render(<LogDrawer task={task} onClose={onClose} />)

    await waitFor(() => {
      expect(readLog).toHaveBeenCalledWith('run-456')
    })
  })

  it('shows status label for done agent', async () => {
    vi.mocked(window.api.sprint.readLog).mockResolvedValue({ content: '', status: 'done' })

    const task = makeTask({ agent_run_id: 'run-789', status: 'done' })
    render(<LogDrawer task={task} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText(/done/)).toBeInTheDocument()
    })
  })

  it('close button calls onClose', async () => {
    const user = userEvent.setup()
    const task = makeTask()
    render(<LogDrawer task={task} onClose={onClose} />)

    const closeButtons = screen.getAllByRole('button', { name: /Close|✕/ })
    await user.click(closeButtons[closeButtons.length - 1])

    expect(onClose).toHaveBeenCalled()
  })

  it('Open in Sessions button dispatches bde:navigate event', async () => {
    const user = userEvent.setup()
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const task = makeTask({ agent_run_id: 'session-abc' })
    render(<LogDrawer task={task} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Open in Sessions' }))

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bde:navigate',
        detail: { view: 'sessions', sessionId: 'session-abc' },
      })
    )
    expect(onClose).toHaveBeenCalled()
    dispatchSpy.mockRestore()
  })
})
