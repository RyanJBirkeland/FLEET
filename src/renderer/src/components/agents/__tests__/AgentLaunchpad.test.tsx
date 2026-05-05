import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../../stores/localAgents', () => ({
  useLocalAgentsStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      spawnAgent: vi.fn().mockResolvedValue({ pid: 1, logPath: '/tmp/log', id: 'agent-1' }),
      fetchProcesses: vi.fn(),
      isSpawning: false
    })
  )
}))

vi.mock('../../../stores/promptTemplates', () => ({
  usePromptTemplatesStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      templates: [],
      loading: false,
      loadTemplates: vi.fn()
    })
  )
}))

vi.mock('../../../stores/toasts', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
}))

vi.mock('../../../hooks/useRepoOptions', () => ({
  useRepoOptions: () => [{ label: 'FLEET', owner: 'owner', color: '#fff' }]
}))

Object.defineProperty(window, 'api', {
  value: {
    ...(window as unknown as { api: Record<string, unknown> }).api,
    git: {
      ...((window as unknown as { api: { git: Record<string, unknown> } }).api?.git ?? {}),
      getRepoPaths: vi.fn().mockResolvedValue({ fleet: '/Users/test/projects/FLEET' })
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

import { AgentLaunchpad } from '../AgentLaunchpad'

describe('AgentLaunchpad', () => {
  const onAgentSpawned = vi.fn()

  it('renders the V2 center-column shell with SPAWN AGENT eyebrow', () => {
    render(<AgentLaunchpad onAgentSpawned={onAgentSpawned} />)
    expect(screen.getByText('SPAWN AGENT')).toBeInTheDocument()
    expect(screen.getByText('New scratchpad agent')).toBeInTheDocument()
  })

  it('renders the LaunchpadGrid inside the shell', () => {
    render(<AgentLaunchpad onAgentSpawned={onAgentSpawned} />)
    expect(screen.getByTestId('launchpad-grid')).toBeInTheDocument()
  })
})
