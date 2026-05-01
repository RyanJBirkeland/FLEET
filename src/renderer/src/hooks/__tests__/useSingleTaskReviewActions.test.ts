import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSingleTaskReviewActions } from '../useSingleTaskReviewActions'
import type { RevisionFeedbackEntry } from '../../../../shared/types/task-types'

vi.mock('../../stores/codeReview')
vi.mock('../../stores/sprintTasks')
vi.mock('../../stores/toasts', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))
vi.mock('../../hooks/useGitHubStatus', () => ({
  useGitHubStatus: () => ({ configured: true })
}))

// Mock the modals hook — controls what confirm() and prompt() resolve to
const mockConfirm = vi.fn()
const mockPrompt = vi.fn()

vi.mock('../../hooks/useReviewActionModals', () => ({
  useReviewActionModals: () => ({
    confirm: mockConfirm,
    prompt: mockPrompt,
    confirmProps: {
      open: false,
      title: '',
      message: '',
      onConfirm: vi.fn(),
      onCancel: vi.fn()
    },
    promptProps: {
      open: false,
      message: '',
      onConfirm: vi.fn(),
      onCancel: vi.fn()
    }
  })
}))

import { useCodeReviewStore } from '../../stores/codeReview'
import { useSprintTasks } from '../../stores/sprintTasks'
import { toast } from '../../stores/toasts'

const mockSelectTask = vi.fn()
const mockLoadData = vi.fn()

const mockTask = {
  id: 'task-1',
  title: 'Test Task',
  status: 'review' as const,
  repo: 'fleet',
  spec: 'Test spec',
  prompt: '',
  revision_feedback: [] as RevisionFeedbackEntry[],
  updated_at: '2026-04-01T00:00:00Z',
  rebased_at: null
}

function setupStores(task = mockTask) {
  vi.mocked(useCodeReviewStore).mockImplementation((selector: any) =>
    selector({ selectedTaskId: task.id, selectTask: mockSelectTask })
  )
  vi.mocked(useSprintTasks).mockImplementation((selector: any) =>
    selector({ tasks: [task], loadData: mockLoadData })
  )
}

describe('useSingleTaskReviewActions — requestRevision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupStores()
    global.window.api = {
      review: {
        checkFreshness: vi.fn().mockResolvedValue({ status: 'fresh' }),
        requestRevision: vi.fn().mockResolvedValue(undefined),
        shipIt: vi.fn().mockResolvedValue({ success: true }),
        mergeLocally: vi.fn().mockResolvedValue({ success: true }),
        createPr: vi.fn().mockResolvedValue({ prUrl: 'https://github.com/pr/1' }),
        rebase: vi.fn().mockResolvedValue({ success: true }),
        discard: vi.fn().mockResolvedValue(undefined)
      },
      sprint: {
        update: vi.fn().mockResolvedValue(undefined)
      }
    } as any
  })

  it('passes revision_feedback atomically to review.requestRevision (no separate sprint.update)', async () => {
    mockPrompt.mockResolvedValue('fix the button color')

    const { result } = renderHook(() => useSingleTaskReviewActions())

    await act(async () => {
      await result.current.requestRevision()
    })

    // revision_feedback is now sent atomically with the state transition —
    // no separate sprint.update call that could persist on failure.
    expect(window.api.sprint.update).not.toHaveBeenCalled()
    expect(window.api.review.requestRevision).toHaveBeenCalledWith({
      taskId: 'task-1',
      feedback: 'fix the button color',
      mode: 'fresh',
      revisionFeedback: [
        expect.objectContaining({
          feedback: 'fix the button color',
          attempt: 1
        })
      ]
    })
  })

  it('increments attempt number based on prior revision_feedback entries', async () => {
    const taskWithHistory = {
      ...mockTask,
      revision_feedback: [
        { timestamp: '2026-04-01T00:00:00Z', feedback: 'prior note', attempt: 1 }
      ] as RevisionFeedbackEntry[]
    }
    setupStores(taskWithHistory)
    mockPrompt.mockResolvedValue('second round of changes')

    const { result } = renderHook(() => useSingleTaskReviewActions())

    await act(async () => {
      await result.current.requestRevision()
    })

    expect(window.api.sprint.update).not.toHaveBeenCalled()
    expect(window.api.review.requestRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        revisionFeedback: expect.arrayContaining([
          expect.objectContaining({ attempt: 1, feedback: 'prior note' }),
          expect.objectContaining({ attempt: 2, feedback: 'second round of changes' })
        ])
      })
    )
  })

  it('does not call sprint.update when user cancels the prompt', async () => {
    mockPrompt.mockResolvedValue(null)

    const { result } = renderHook(() => useSingleTaskReviewActions())

    await act(async () => {
      await result.current.requestRevision()
    })

    expect(window.api.sprint.update).not.toHaveBeenCalled()
    expect(window.api.review.requestRevision).not.toHaveBeenCalled()
  })

  it('shows success toast with agent-centric message after revision requested', async () => {
    mockPrompt.mockResolvedValue('please fix the types')

    const { result } = renderHook(() => useSingleTaskReviewActions())

    await act(async () => {
      await result.current.requestRevision()
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Revision requested — agent will re-run with your feedback'
      )
    })
  })

  it('shows error toast when review.requestRevision rejects', async () => {
    mockPrompt.mockResolvedValue('some feedback')
    window.api.review.requestRevision = vi.fn().mockRejectedValue(new Error('revision failed'))

    const { result } = renderHook(() => useSingleTaskReviewActions())

    await act(async () => {
      await result.current.requestRevision()
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('revision failed')
    })
  })
})
