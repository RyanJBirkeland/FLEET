import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useReviewPartnerStore } from './reviewPartner'

describe('useReviewPartnerStore', () => {
  const localStorageMock = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock)
    vi.clearAllMocks()
    // Reset store state between tests
    useReviewPartnerStore.setState({
      panelOpen: false,
      reviewByTask: {},
      messagesByTask: {},
      activeStreamByTask: {}
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('panel toggle', () => {
    it('flips panelOpen', () => {
      useReviewPartnerStore.getState().togglePanel()
      expect(useReviewPartnerStore.getState().panelOpen).toBe(true)
      useReviewPartnerStore.getState().togglePanel()
      expect(useReviewPartnerStore.getState().panelOpen).toBe(false)
    })
  })

  describe('clearMessages', () => {
    it('removes all messages for a task and persists the clear', () => {
      useReviewPartnerStore.setState({
        messagesByTask: {
          'task-1': [{ id: '1', role: 'user', content: 'x', timestamp: 0 }]
        }
      })
      useReviewPartnerStore.getState().clearMessages('task-1')
      expect(useReviewPartnerStore.getState().messagesByTask['task-1']).toEqual([])
      // Verify localStorage was touched with the cleared state
      const calls = localStorageMock.setItem.mock.calls.filter(
        ([key]) => key === 'fleet:review-partner-messages'
      )
      expect(calls.length).toBeGreaterThan(0)
    })
  })

  describe('invalidate', () => {
    it('resets reviewByTask to idle, clears messages, and nulls activeStream', () => {
      useReviewPartnerStore.setState({
        reviewByTask: { 'task-1': { status: 'ready' } },
        messagesByTask: { 'task-1': [{ id: '1', role: 'user', content: 'x', timestamp: 0 }] },
        activeStreamByTask: { 'task-1': 'stream-abc' }
      })
      useReviewPartnerStore.getState().invalidate('task-1')
      const state = useReviewPartnerStore.getState()
      expect(state.reviewByTask['task-1']).toEqual({ status: 'idle' })
      expect(state.messagesByTask['task-1']).toEqual([])
      expect(state.activeStreamByTask['task-1']).toBeNull()
    })

    it('is a no-op for a task with no prior state', () => {
      useReviewPartnerStore.getState().invalidate('task-99')
      const state = useReviewPartnerStore.getState()
      expect(state.reviewByTask['task-99']).toEqual({ status: 'idle' })
      expect(state.messagesByTask['task-99']).toEqual([])
      expect(state.activeStreamByTask['task-99']).toBeNull()
    })

    it('persists the cleared messages to localStorage', () => {
      useReviewPartnerStore.setState({
        messagesByTask: { 'task-1': [{ id: '1', role: 'user', content: 'x', timestamp: 0 }] }
      })
      useReviewPartnerStore.getState().invalidate('task-1')
      const calls = localStorageMock.setItem.mock.calls.filter(
        ([key]) => key === 'fleet:review-partner-messages'
      )
      expect(calls.length).toBeGreaterThan(0)
    })
  })
})
