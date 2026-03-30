import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../stores/sprintTasks', () => ({
  useSprintTasks: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      tasks: [],
      loading: false,
      loadData: vi.fn().mockResolvedValue(undefined)
    })
  )
}))

vi.mock('../../stores/costData', () => ({
  useCostDataStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      localAgents: [],
      totalCost: 0,
      fetchLocalAgents: vi.fn().mockResolvedValue(undefined)
    })
  )
}))

vi.mock('../../hooks/useSprintPolling', () => ({ useSprintPolling: vi.fn() }))

vi.mock('../../components/neon', async () => {
  const actual =
    await vi.importActual<typeof import('../../components/neon')>('../../components/neon')
  return {
    ...actual,
    ScanlineOverlay: () => null,
    ParticleField: () => null
  }
})

Object.defineProperty(window, 'api', {
  value: {
    getPrList: vi.fn().mockResolvedValue([]),
    openExternal: vi.fn(),
    onExternalSprintChange: vi.fn().mockReturnValue(() => {}),
    dashboard: {
      completionsPerHour: vi.fn().mockResolvedValue([]),
      recentEvents: vi.fn().mockResolvedValue([])
    }
  },
  writable: true,
  configurable: true
})

// ---------------------------------------------------------------------------
// Subject + stores
// ---------------------------------------------------------------------------

import DashboardView from '../DashboardView'
import { useSprintUI } from '../../stores/sprintUI'
import { usePanelLayoutStore } from '../../stores/panelLayout'
import { useSprintTasks } from '../../stores/sprintTasks'
import { useCostDataStore } from '../../stores/costData'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    useSprintUI.setState({ searchQuery: '', statusFilter: 'all' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the Ops Deck command center', () => {
    render(<DashboardView />)
    expect(screen.getByText('BDE Command Center')).toBeInTheDocument()
  })

  it('renders stat counters for key metrics', () => {
    render(<DashboardView />)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Queued')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByText('PRs')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('renders pipeline and cost sections', () => {
    render(<DashboardView />)
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
    expect(screen.getByText('Cost 24h')).toBeInTheDocument()
  })

  it('clicking Active stat navigates to Sprint with in-progress filter', () => {
    render(<DashboardView />)
    const activeStat = screen.getByText('Active').closest('[role="button"]')!
    fireEvent.click(activeStat)

    expect(useSprintUI.getState().statusFilter).toBe('in-progress')
    expect(usePanelLayoutStore.getState().activeView).toBe('sprint')
  })

  it('clicking Done stat navigates to Sprint with done filter', () => {
    render(<DashboardView />)
    // "Done" may appear in both stats and pipeline — find the one with role=button
    const doneStats = screen.getAllByText('Done')
    const doneStat = doneStats
      .find((el) => el.closest('[role="button"]'))!
      .closest('[role="button"]')!
    fireEvent.click(doneStat)

    expect(useSprintUI.getState().statusFilter).toBe('done')
    expect(usePanelLayoutStore.getState().activeView).toBe('sprint')
  })

  it('clicking Blocked stat navigates to Sprint with blocked filter', () => {
    render(<DashboardView />)
    const blockedElements = screen.getAllByText('Blocked')
    const blockedStat = blockedElements
      .find((el) => el.closest('[role="button"]'))!
      .closest('[role="button"]')!
    fireEvent.click(blockedStat)

    expect(useSprintUI.getState().statusFilter).toBe('blocked')
    expect(usePanelLayoutStore.getState().activeView).toBe('sprint')
  })

  it('renders chart data from completionsPerHour', async () => {
    vi.mocked(window.api.dashboard.completionsPerHour).mockResolvedValue([
      { hour: '10:00', count: 5 },
      { hour: '11:00', count: 3 }
    ])
    render(<DashboardView />)
    // Flush initial useBackoffInterval tick (setTimeout 0ms with jitter=0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByText('Completions / Hour')).toBeInTheDocument()
  })

  it('renders feed events from recentEvents', async () => {
    vi.mocked(window.api.dashboard.recentEvents).mockResolvedValue([
      {
        id: 1,
        event_type: 'complete',
        agent_id: 'agent-1',
        payload: '',
        timestamp: Date.now() - 5000
      },
      {
        id: 2,
        event_type: 'error',
        agent_id: 'agent-2',
        payload: '',
        timestamp: Date.now() - 10000
      },
      {
        id: 3,
        event_type: 'spawn',
        agent_id: 'agent-3',
        payload: '',
        timestamp: Date.now() - 20000
      }
    ])
    render(<DashboardView />)
    // Flush initial useBackoffInterval tick
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByText('complete: agent-1')).toBeInTheDocument()
    expect(screen.getByText('error: agent-2')).toBeInTheDocument()
    expect(screen.getByText('spawn: agent-3')).toBeInTheDocument()
  })

  it('re-fetches dashboard data on polling interval', async () => {
    render(<DashboardView />)

    // Flush the initial useBackoffInterval tick
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(window.api.dashboard.completionsPerHour).toHaveBeenCalledTimes(1)

    // Advance past the 60s polling interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(window.api.dashboard.completionsPerHour).toHaveBeenCalledTimes(2)
    expect(window.api.dashboard.recentEvents).toHaveBeenCalledTimes(2)
    expect(window.api.getPrList).toHaveBeenCalledTimes(2)
  })

  it('logs errors instead of swallowing them', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(window.api.dashboard.completionsPerHour).mockRejectedValueOnce(
      new Error('Network error')
    )

    render(<DashboardView />)

    // Flush initial useBackoffInterval tick to trigger the rejected promise
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Dashboard] Failed to fetch completions:',
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it('renders correct PR count from getPrList payload', async () => {
    vi.mocked(window.api.getPrList).mockResolvedValue({
      prs: [
        {
          number: 1,
          title: 'PR1',
          html_url: '',
          state: 'open',
          draft: false,
          created_at: '',
          updated_at: '',
          head: { ref: 'a', sha: 'b' },
          base: { ref: 'main' },
          user: { login: 'u' },
          merged: false,
          merged_at: null,
          repo: 'r'
        },
        {
          number: 2,
          title: 'PR2',
          html_url: '',
          state: 'open',
          draft: false,
          created_at: '',
          updated_at: '',
          head: { ref: 'c', sha: 'd' },
          base: { ref: 'main' },
          user: { login: 'u' },
          merged: false,
          merged_at: null,
          repo: 'r'
        }
      ],
      checks: {}
    })
    render(<DashboardView />)
    // Flush initial useBackoffInterval tick
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  // ---------- Branch coverage: SuccessRing (rate null vs values) ----------

  it('shows "No terminal tasks" when no done/failed tasks', async () => {
    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByText('No terminal tasks')).toBeInTheDocument()
  })

  it('shows success ring with percentage when done tasks exist', async () => {
    vi.mocked(useSprintTasks).mockImplementation((selector: any) =>
      selector({
        tasks: [
          { id: '1', status: 'done', title: 'T1', completed_at: new Date().toISOString() },
          { id: '2', status: 'done', title: 'T2', completed_at: new Date().toISOString() },
          { id: '3', status: 'failed', title: 'T3' }
        ],
        loading: false,
        loadData: vi.fn()
      })
    )
    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    // 2 done, 1 failed = 67%
    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByText(/2✓/)).toBeInTheDocument()
    expect(screen.getByText(/1✗/)).toBeInTheDocument()
  })

  it('shows success ring with high rate (>=80) cyan accent', async () => {
    vi.mocked(useSprintTasks).mockImplementation((selector: any) =>
      selector({
        tasks: [
          { id: '1', status: 'done', title: 'T1', completed_at: new Date().toISOString() },
          { id: '2', status: 'done', title: 'T2', completed_at: new Date().toISOString() },
          { id: '3', status: 'done', title: 'T3', completed_at: new Date().toISOString() },
          { id: '4', status: 'done', title: 'T4', completed_at: new Date().toISOString() },
          { id: '5', status: 'failed', title: 'T5' }
        ],
        loading: false,
        loadData: vi.fn()
      })
    )
    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  // ---------- Branch coverage: avgDuration (null vs value) ----------

  it('shows dash when no agent durations available', async () => {
    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    // avgDuration is null, should show '—'
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows formatted duration when agent runs have duration', async () => {
    vi.mocked(useCostDataStore).mockImplementation((selector: any) =>
      selector({
        localAgents: [
          { id: 'a1', durationMs: 120000, costUsd: 0.5, startedAt: new Date().toISOString(), taskTitle: 'T1' },
          { id: 'a2', durationMs: 180000, costUsd: 0.3, startedAt: new Date().toISOString(), taskTitle: 'T2' }
        ],
        totalCost: 0.8,
        fetchLocalAgents: vi.fn()
      })
    )
    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    // avg = 150000ms = 150s = 2m 30s
    expect(screen.getByText('2m 30s')).toBeInTheDocument()
    expect(screen.getByText('2 runs tracked')).toBeInTheDocument()
  })

  it('shows hours in duration for long runs', async () => {
    vi.mocked(useCostDataStore).mockImplementation((selector: any) =>
      selector({
        localAgents: [
          { id: 'a1', durationMs: 7200000, costUsd: 1.0, startedAt: new Date().toISOString(), taskTitle: 'T1' }
        ],
        totalCost: 1.0,
        fetchLocalAgents: vi.fn()
      })
    )
    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    // 7200000ms = 2h 0m
    expect(screen.getByText('2h 0m')).toBeInTheDocument()
  })

  it('shows seconds for short durations', async () => {
    vi.mocked(useCostDataStore).mockImplementation((selector: any) =>
      selector({
        localAgents: [
          { id: 'a1', durationMs: 45000, costUsd: 0.1, startedAt: new Date().toISOString(), taskTitle: 'T1' }
        ],
        totalCost: 0.1,
        fetchLocalAgents: vi.fn()
      })
    )
    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByText('45s')).toBeInTheDocument()
  })

  // ---------- Branch coverage: recentCompletions ----------

  it('renders Recent Completions card', () => {
    render(<DashboardView />)
    expect(screen.getByText('Recent Completions')).toBeInTheDocument()
  })

  it('shows recent completions when done tasks exist', async () => {
    vi.mocked(useSprintTasks).mockImplementation((selector: any) =>
      selector({
        tasks: [
          { id: '1', status: 'done', title: 'Implement feature X', completed_at: new Date().toISOString() }
        ],
        loading: false,
        loadData: vi.fn()
      })
    )
    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByText('Implement feature X')).toBeInTheDocument()
    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  // ---------- Branch coverage: error states with retry ----------

  it('shows error state with retry button when all fetches fail', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(window.api.dashboard.completionsPerHour).mockRejectedValue(new Error('fail'))
    vi.mocked(window.api.dashboard.recentEvents).mockRejectedValue(new Error('fail'))
    vi.mocked(window.api.getPrList).mockRejectedValue(new Error('fail'))

    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })

    expect(screen.getByText('Retry')).toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it('retries fetching data when Retry button clicked', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(window.api.dashboard.completionsPerHour).mockRejectedValue(new Error('fail'))
    vi.mocked(window.api.dashboard.recentEvents).mockRejectedValue(new Error('fail'))
    vi.mocked(window.api.getPrList).mockRejectedValue(new Error('fail'))

    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })

    const callCountBefore = vi.mocked(window.api.dashboard.completionsPerHour).mock.calls.length
    const retryBtn = screen.getByText('Retry')
    await act(async () => { fireEvent.click(retryBtn) })

    expect(vi.mocked(window.api.dashboard.completionsPerHour).mock.calls.length).toBeGreaterThan(callCountBefore)
    consoleSpy.mockRestore()
  })

  // ---------- Branch coverage: loading state ----------

  it('shows Loading... text during initial load with no chart data', () => {
    render(<DashboardView />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  // ---------- Branch coverage: clicking Queued and PRs stats ----------

  it('clicking Queued stat navigates to Sprint with todo filter', () => {
    render(<DashboardView />)
    const queuedElements = screen.getAllByText('Queued')
    const queuedStat = queuedElements
      .find((el) => el.closest('[role="button"]'))!
      .closest('[role="button"]')!
    fireEvent.click(queuedStat)

    expect(useSprintUI.getState().statusFilter).toBe('todo')
    expect(usePanelLayoutStore.getState().activeView).toBe('sprint')
  })

  it('clicking PRs stat navigates to Sprint with awaiting-review filter', () => {
    render(<DashboardView />)
    const prsElements = screen.getAllByText('PRs')
    const prsStat = prsElements
      .find((el) => el.closest('[role="button"]'))!
      .closest('[role="button"]')!
    fireEvent.click(prsStat)

    expect(useSprintUI.getState().statusFilter).toBe('awaiting-review')
    expect(usePanelLayoutStore.getState().activeView).toBe('sprint')
  })

  // ---------- Branch coverage: cost trend data ----------

  it('renders cost trend chart with agent data', async () => {
    vi.mocked(useCostDataStore).mockImplementation((selector: any) =>
      selector({
        localAgents: [
          { id: 'a1', durationMs: 60000, costUsd: 0.5, startedAt: new Date().toISOString(), taskTitle: 'Task A' },
          { id: 'a2', durationMs: 120000, costUsd: 1.2, startedAt: new Date().toISOString(), taskTitle: 'Task B' }
        ],
        totalCost: 1.7,
        fetchLocalAgents: vi.fn()
      })
    )
    render(<DashboardView />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByText(/last 2 runs/)).toBeInTheDocument()
    expect(screen.getByText('$1.70')).toBeInTheDocument()
  })
})
