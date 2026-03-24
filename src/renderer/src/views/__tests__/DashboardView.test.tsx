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

Object.defineProperty(window, 'api', {
  value: {
    getPrList: vi.fn().mockResolvedValue({ prs: [], checks: {} }),
    openExternal: vi.fn(),
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

  it('renders all four dashboard cards', () => {
    render(<DashboardView />)
    expect(screen.getByText('Active Tasks')).toBeInTheDocument()
    expect(screen.getByText('Recent Completions')).toBeInTheDocument()
    expect(screen.getByText('Cost Summary')).toBeInTheDocument()
    expect(screen.getByText('Open PRs')).toBeInTheDocument()
  })

  it('shows empty state messages when no data', () => {
    render(<DashboardView />)
    expect(screen.getByText('No active tasks')).toBeInTheDocument()
    expect(screen.getByText('No completed tasks yet')).toBeInTheDocument()
  })
})
