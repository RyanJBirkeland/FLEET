import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAgentSessionPolling } from '../useAgentSessionPolling'

// Mock useBackoffInterval to prevent timer side-effects
const mockUseBackoffInterval = vi.fn()
vi.mock('../useBackoffInterval', () => ({
  useBackoffInterval: (...args: unknown[]) => mockUseBackoffInterval(...args)
}))

// Mock the agentHistory store
const mockFetchAgents = vi.fn().mockResolvedValue(undefined)

vi.mock('../../stores/agentHistory', () => {
  const store = vi.fn((sel: (s: unknown) => unknown) => sel({ fetchAgents: mockFetchAgents }))
  ;(store as any).getState = () => ({ fetchAgents: mockFetchAgents })
  return { useAgentHistoryStore: store }
})

describe('useAgentSessionPolling', () => {
  beforeEach(() => {
    mockFetchAgents.mockClear()
    mockUseBackoffInterval.mockClear()
  })

  it('renders without error', () => {
    expect(() => {
      renderHook(() => useAgentSessionPolling())
    }).not.toThrow()
  })

  it('calls fetchAgents on mount', () => {
    renderHook(() => useAgentSessionPolling())
    expect(mockFetchAgents).toHaveBeenCalledTimes(1)
  })

  it('registers useBackoffInterval with fetchAgents and POLL_SESSIONS_INTERVAL', () => {
    renderHook(() => useAgentSessionPolling())
    expect(mockUseBackoffInterval).toHaveBeenCalledWith(mockFetchAgents, 10_000)
  })
})
