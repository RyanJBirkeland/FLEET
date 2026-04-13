import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCostPolling } from '../useCostPolling'

// Mock useBackoffInterval to prevent timer side-effects
const mockUseBackoffInterval = vi.fn()
vi.mock('../useBackoffInterval', () => ({
  useBackoffInterval: (...args: unknown[]) => mockUseBackoffInterval(...args)
}))

// Mock the costData store
const mockFetchLocalAgents = vi.fn().mockResolvedValue(undefined)

vi.mock('../../stores/costData', () => {
  const store = vi.fn((sel: (s: unknown) => unknown) =>
    sel({ fetchLocalAgents: mockFetchLocalAgents })
  )
  ;(store as any).getState = () => ({ fetchLocalAgents: mockFetchLocalAgents })
  return { useCostDataStore: store }
})

describe('useCostPolling', () => {
  beforeEach(() => {
    mockFetchLocalAgents.mockClear()
    mockUseBackoffInterval.mockClear()
  })

  it('renders without error', () => {
    expect(() => {
      renderHook(() => useCostPolling())
    }).not.toThrow()
  })

  it('calls fetchLocalAgents on mount', () => {
    renderHook(() => useCostPolling())
    expect(mockFetchLocalAgents).toHaveBeenCalledTimes(1)
  })

  it('registers useBackoffInterval with fetchLocalAgents and POLL_COST_INTERVAL', () => {
    renderHook(() => useCostPolling())
    expect(mockUseBackoffInterval).toHaveBeenCalledWith(mockFetchLocalAgents, 30_000)
  })
})
