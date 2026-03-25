import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../stores/sprintTasks', () => ({
  useSprintTasks: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      tasks: [],
      loading: false,
      loadData: vi.fn().mockResolvedValue(undefined),
    })
  ),
}))

vi.mock('../../stores/costData', () => ({
  useCostDataStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      localAgents: [],
      totalCost: 0,
      fetchLocalAgents: vi.fn().mockResolvedValue(undefined),
    })
  ),
}))

vi.mock('../../components/neon', async () => {
  const actual = await vi.importActual<typeof import('../../components/neon')>(
    '../../components/neon',
  )
  return {
    ...actual,
    ScanlineOverlay: () => null,
    ParticleField: () => null,
  }
})

Object.defineProperty(window, 'api', {
  value: {
    getPrList: vi.fn().mockResolvedValue([]),
    openExternal: vi.fn(),
    dashboard: {
      completionsPerHour: vi.fn().mockResolvedValue([]),
      recentEvents: vi.fn().mockResolvedValue([]),
    },
  },
  writable: true,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

import DashboardView from '../DashboardView'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Ops Deck command center', () => {
    render(<DashboardView />)
    expect(screen.getByText('BDE Command Center')).toBeInTheDocument()
  })

  it('renders stat counters for key metrics', () => {
    render(<DashboardView />)
    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(screen.getByText('PRs')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('renders pipeline and cost sections', () => {
    render(<DashboardView />)
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
    expect(screen.getByText(/Cost/)).toBeInTheDocument()
  })
})
