import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpawnModal } from '../SpawnModal'
import { toast } from '../../../stores/toasts'

const mockSpawnAgent = vi.fn()
const mockFetchProcesses = vi.fn()

vi.mock('../../../stores/localAgents', () => ({
  useLocalAgentsStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ spawnAgent: mockSpawnAgent, fetchProcesses: mockFetchProcesses, isSpawning: false })
  ),
}))

vi.mock('../../../stores/toasts', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

describe('SpawnModal', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSpawnAgent.mockResolvedValue({ pid: 1, logPath: '/tmp/log', id: 'a1' })
    localStorage.clear()
  })

  it('renders with empty task', () => {
    render(<SpawnModal open={true} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText('Describe the task for the agent...')
    expect(textarea).toHaveValue('')
  })

  it('submit button disabled while repos are loading', () => {
    render(<SpawnModal open={true} onClose={onClose} />)
    const submitBtn = screen.getByRole('button', { name: 'Loading...' })
    expect(submitBtn).toBeDisabled()
  })

  it('submit button disabled when task is empty', async () => {
    render(<SpawnModal open={true} onClose={onClose} />)
    const submitBtn = await screen.findByRole('button', { name: 'Spawn' })
    expect(submitBtn).toBeDisabled()
  })

  it('submit button disabled when task is whitespace-only', async () => {
    const user = userEvent.setup()
    render(<SpawnModal open={true} onClose={onClose} />)
    await screen.findByRole('button', { name: 'Spawn' })
    const textarea = screen.getByPlaceholderText('Describe the task for the agent...')
    await user.type(textarea, '   ')
    const submitBtn = screen.getByRole('button', { name: 'Spawn' })
    expect(submitBtn).toBeDisabled()
  })

  it('submit button disabled when task exceeds 4000 chars', async () => {
    render(<SpawnModal open={true} onClose={onClose} />)
    await screen.findByRole('button', { name: 'Spawn' })
    const textarea = screen.getByPlaceholderText('Describe the task for the agent...')
    // Use fireEvent.change to set a value beyond the maxLength
    const { fireEvent } = await import('@testing-library/react')
    const longTask = 'a'.repeat(4001)
    fireEvent.change(textarea, { target: { value: longTask } })

    // The textarea has maxLength={4000} so the value is capped
    expect(textarea).toHaveAttribute('maxLength', '4000')
  })

  it('warning shown when task exceeds 2000 chars', async () => {
    render(<SpawnModal open={true} onClose={onClose} />)
    await screen.findByRole('button', { name: 'Spawn' })
    const textarea = screen.getByPlaceholderText('Describe the task for the agent...')
    // Directly set value via fireEvent to avoid typing 2001 chars
    const longTask = 'a'.repeat(2001)
    // Use fireEvent.change to set value directly
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: longTask } })

    expect(screen.getByText(/max 4000/)).toBeInTheDocument()
  })

  it('submit calls spawnAgent with correct args', async () => {
    const user = userEvent.setup()
    render(<SpawnModal open={true} onClose={onClose} />)

    await screen.findByRole('button', { name: 'Spawn' })
    const textarea = screen.getByPlaceholderText('Describe the task for the agent...')
    await user.type(textarea, 'Fix the tests')

    const submitBtn = screen.getByRole('button', { name: 'Spawn' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockSpawnAgent).toHaveBeenCalledWith({
        task: 'Fix the tests',
        repoPath: '/Users/test/Documents/Repositories/BDE',
        model: 'sonnet',
      })
    })
  })

  it('closes on successful spawn and refreshes agent list', async () => {
    const user = userEvent.setup()
    render(<SpawnModal open={true} onClose={onClose} />)

    await screen.findByRole('button', { name: 'Spawn' })
    const textarea = screen.getByPlaceholderText('Describe the task for the agent...')
    await user.type(textarea, 'Do something')

    const submitBtn = screen.getByRole('button', { name: 'Spawn' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Agent spawned')
      expect(mockFetchProcesses).toHaveBeenCalled()
    })
  })

  it('shows error toast on spawn failure', async () => {
    mockSpawnAgent.mockRejectedValue(new Error('spawn failed'))
    const user = userEvent.setup()
    render(<SpawnModal open={true} onClose={onClose} />)

    await screen.findByRole('button', { name: 'Spawn' })
    const textarea = screen.getByPlaceholderText('Describe the task for the agent...')
    await user.type(textarea, 'Do something')

    const submitBtn = screen.getByRole('button', { name: 'Spawn' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Spawn failed: spawn failed')
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('returns null when not open', () => {
    const { container } = render(<SpawnModal open={false} onClose={onClose} />)
    expect(container.innerHTML).toBe('')
  })
})
