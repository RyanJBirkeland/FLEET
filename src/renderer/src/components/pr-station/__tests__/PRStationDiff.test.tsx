import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockGetPRDiff = vi.fn()
const mockGetReviewComments = vi.fn()

vi.mock('../../../lib/github-api', () => ({
  getPRDiff: (...args: unknown[]) => mockGetPRDiff(...args),
  getReviewComments: (...args: unknown[]) => mockGetReviewComments(...args),
}))

vi.mock('../../../lib/diff-parser', () => ({
  parseDiffChunked: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../stores/pendingReview', () => ({
  usePendingReviewStore: (selector: (s: unknown) => unknown) =>
    selector({
      pendingComments: new Map(),
      addComment: vi.fn(),
      removeComment: vi.fn(),
    }),
}))

vi.mock('../../../stores/ui', () => ({
  useUIStore: (selector: (s: unknown) => unknown) =>
    selector({ theme: 'dark' }),
}))

vi.mock('../../diff/DiffViewer', () => ({
  DiffViewer: ({ files }: { files: unknown[] }) => (
    <div data-testid="diff-viewer">{files.length} files</div>
  ),
}))

vi.mock('../../diff/DiffSizeWarning', () => ({
  DiffSizeWarning: () => <div data-testid="diff-size-warning" />,
}))

import { PRStationDiff } from '../PRStationDiff'
import type { OpenPr } from '../../../../../shared/types'

const mockPr: OpenPr = {
  number: 42,
  title: 'My Feature PR',
  html_url: 'https://github.com/o/r/pull/42',
  state: 'open',
  draft: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  head: { ref: 'feat/my-feature', sha: 'abc123' },
  base: { ref: 'main' },
  user: { login: 'alice' },
  merged: false,
  merged_at: null,
  repo: 'BDE',
}

describe('PRStationDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPRDiff.mockResolvedValue('diff --git a/foo.ts b/foo.ts\n')
    mockGetReviewComments.mockResolvedValue([])
  })

  it('fetches the diff from GitHub API', async () => {
    render(<PRStationDiff pr={mockPr} />)
    await waitFor(() => expect(mockGetPRDiff).toHaveBeenCalledWith('RyanJBirkeland', 'BDE', 42))
  })

  it('renders DiffViewer after diff loads', async () => {
    render(<PRStationDiff pr={mockPr} />)
    await waitFor(() => expect(screen.getByTestId('diff-viewer')).toBeInTheDocument())
  })

  it('shows error banner on fetch failure', async () => {
    mockGetPRDiff.mockRejectedValue(new Error('network error'))
    render(<PRStationDiff pr={mockPr} />)
    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument())
  })

  it('fetches review comments in parallel with diff', async () => {
    render(<PRStationDiff pr={mockPr} />)
    await waitFor(() => expect(mockGetReviewComments).toHaveBeenCalledWith('RyanJBirkeland', 'BDE', 42))
  })
})
