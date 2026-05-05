import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSpawnAgent = vi.fn().mockResolvedValue({ pid: 1, logPath: '/tmp/log', id: 'agent-1' })
const mockFetchProcesses = vi.fn()
const mockGetRepoPaths = vi.fn().mockResolvedValue({ fleet: '/Users/test/projects/FLEET' })
const mockLoadTemplates = vi.fn()
const mockTemplates = [
  {
    id: 'builtin-clean-code',
    name: 'Clean Code',
    icon: '🧹',
    accent: 'cyan',
    description: 'Audit',
    questions: [],
    promptTemplate: 'Audit the codebase for clean code issues.',
    order: 0,
    builtIn: true
  },
  {
    id: 'builtin-fix-bug',
    name: 'Fix Bug',
    icon: '🐛',
    accent: 'red',
    description: 'Fix a bug',
    questions: [],
    promptTemplate: 'Fix the bug.',
    order: 1,
    builtIn: true
  },
  {
    id: 'builtin-new-feature',
    name: 'New Feature',
    icon: '✨',
    accent: 'blue',
    description: 'Build a feature',
    questions: [],
    promptTemplate: 'Build a new feature.',
    order: 2,
    builtIn: true
  }
]

function makeLocalAgentsSelector(isSpawning: boolean) {
  return (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ spawnAgent: mockSpawnAgent, fetchProcesses: mockFetchProcesses, isSpawning })
}

vi.mock('../../../stores/localAgents', () => ({
  useLocalAgentsStore: vi.fn(makeLocalAgentsSelector(false))
}))

vi.mock('../../../stores/promptTemplates', () => ({
  usePromptTemplatesStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      templates: mockTemplates,
      loading: false,
      loadTemplates: mockLoadTemplates
    })
  )
}))

vi.mock('../../../stores/toasts', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
}))

vi.mock('../../../hooks/useRepoOptions', () => ({
  useRepoOptions: () => [
    { label: 'FLEET', owner: 'owner', color: '#fff' },
    { label: 'life-os', owner: 'owner', color: '#fff' }
  ]
}))

Object.defineProperty(window, 'api', {
  value: {
    ...(window as unknown as { api: Record<string, unknown> }).api,
    git: {
      ...((window as unknown as { api: { git: Record<string, unknown> } }).api?.git ?? {}),
      getRepoPaths: mockGetRepoPaths
    },
    settings: {
      get: vi.fn(),
      set: vi.fn(),
      getJson: vi.fn().mockResolvedValue(null),
      setJson: vi.fn(),
      delete: vi.fn()
    }
  },
  writable: true,
  configurable: true
})

import { LaunchpadGrid } from '../LaunchpadGrid'
import { useLocalAgentsStore } from '../../../stores/localAgents'
import { toast } from '../../../stores/toasts'

describe('LaunchpadGrid', () => {
  const onAgentSpawned = vi.fn()
  const mockedLocalAgentsStore = vi.mocked(useLocalAgentsStore)

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRepoPaths.mockResolvedValue({ fleet: '/Users/test/projects/FLEET' })
    mockedLocalAgentsStore.mockImplementation(makeLocalAgentsSelector(false))
  })

  it('renders quick action tiles from templates', () => {
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)
    expect(screen.getByText('Clean Code')).toBeInTheDocument()
    expect(screen.getByText('Fix Bug')).toBeInTheDocument()
    expect(screen.getByText('New Feature')).toBeInTheDocument()
  })

  it('renders repo selector with first repo selected', () => {
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)
    expect(screen.getByText(/FLEET/)).toBeInTheDocument()
  })

  it('renders task prompt textarea with correct placeholder', () => {
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)
    expect(screen.getByPlaceholderText('What would you like to work on?')).toBeInTheDocument()
  })

  it('renders distinct Task spec and Task prompt labels', () => {
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)
    expect(screen.getByText('Task spec')).toBeInTheDocument()
    expect(screen.getByText('Task prompt')).toBeInTheDocument()
  })

  it('Enter on prompt textarea calls spawnAgent', async () => {
    const user = userEvent.setup()
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)

    await waitFor(() => expect(mockGetRepoPaths).toHaveBeenCalled())

    const input = screen.getByPlaceholderText('What would you like to work on?')
    await user.type(input, 'Fix the bug{Enter}')

    await waitFor(() => {
      expect(mockSpawnAgent).toHaveBeenCalledWith(
        expect.objectContaining({ task: 'Fix the bug', assistant: true })
      )
    })
    expect(onAgentSpawned).toHaveBeenCalled()
  })

  it('Shift+Enter does NOT submit', async () => {
    const user = userEvent.setup()
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)
    const input = screen.getByPlaceholderText('What would you like to work on?')
    await user.type(input, 'text{Shift>}{Enter}{/Shift}')
    expect(mockSpawnAgent).not.toHaveBeenCalled()
  })

  it('clicking a quick-action tile spawns agent with template prompt', async () => {
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)

    await waitFor(() => expect(mockGetRepoPaths).toHaveBeenCalled())

    await userEvent.click(screen.getByText('Clean Code'))

    await waitFor(() => {
      expect(mockSpawnAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          task: 'Audit the codebase for clean code issues.',
          assistant: true
        })
      )
    })
  })

  it('tiles and prompt textarea disabled when spawning', () => {
    mockedLocalAgentsStore.mockImplementation(makeLocalAgentsSelector(true))

    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)

    const input = screen.getByPlaceholderText('What would you like to work on?')
    expect(input).toBeDisabled()

    const tiles = screen.getAllByRole('button', { name: /Clean Code|Fix Bug|New Feature/i })
    for (const tile of tiles) {
      expect(tile).toBeDisabled()
    }
  })

  it('shows error toast when repo path not found', async () => {
    mockGetRepoPaths.mockResolvedValue({})
    const user = userEvent.setup()
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)

    await waitFor(() => expect(mockGetRepoPaths).toHaveBeenCalled())

    const input = screen.getByPlaceholderText('What would you like to work on?')
    await user.type(input, 'Do something{Enter}')

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Repo path not found'))
    })
    expect(mockSpawnAgent).not.toHaveBeenCalled()
  })

  it('renders Browse button for Task spec field', () => {
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)
    expect(screen.getByText('Browse…')).toBeInTheDocument()
  })

  it('Browse button is disabled when spawning', () => {
    mockedLocalAgentsStore.mockImplementation(makeLocalAgentsSelector(true))
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)
    expect(screen.getByText('Browse…').closest('button')).toBeDisabled()
  })

  it('does not render a "Recent" section', () => {
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)
    expect(screen.queryByText(/Recent/i)).not.toBeInTheDocument()
  })

  it('does not render model pills (routing lives in Settings → Models)', () => {
    render(<LaunchpadGrid onAgentSpawned={onAgentSpawned} />)
    for (const label of ['Haiku', 'Sonnet', 'Opus']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
    }
  })
})
