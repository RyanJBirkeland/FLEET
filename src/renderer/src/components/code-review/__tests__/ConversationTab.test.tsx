import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../../lib/render-agent-markdown', () => ({
  renderAgentMarkdown: (text: string) => <span data-testid="rendered-markdown">{text}</span>
}))

const { sprintState } = vi.hoisted(() => ({
  sprintState: {
    tasks: [] as Array<Record<string, unknown>>,
    loading: false,
    loadData: vi.fn()
  }
}))

vi.mock('../../../stores/sprintTasks', () => ({
  useSprintTasks: vi.fn((sel: (s: Record<string, unknown>) => unknown) => sel(sprintState))
}))

vi.mock('../../../stores/codeReview', () => {
  const { create } = require('zustand')
  const store = create(() => ({
    selectedTaskId: null as string | null
  }))
  return { useCodeReviewStore: store }
})

import { ConversationTab } from '../ConversationTab'
import { useCodeReviewStore } from '../../../stores/codeReview'

describe('ConversationTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sprintState.tasks = []
    useCodeReviewStore.setState({ selectedTaskId: null })
  })

  it('shows spec rendered as markdown', () => {
    sprintState.tasks = [
      {
        id: 't1',
        title: 'Task',
        spec: '## Test Spec\nThis is a spec',
        notes: null
      }
    ]
    useCodeReviewStore.setState({ selectedTaskId: 't1' })
    render(<ConversationTab />)

    expect(screen.getByText('Task Spec')).toBeInTheDocument()
    const markdown = screen.getByTestId('rendered-markdown')
    expect(markdown).toBeInTheDocument()
    expect(markdown.textContent).toContain('## Test Spec')
    expect(markdown.textContent).toContain('This is a spec')
  })

  it('shows agent notes when present', () => {
    sprintState.tasks = [
      {
        id: 't1',
        title: 'Task',
        spec: '## Spec',
        notes: 'Some important notes from the agent'
      }
    ]
    useCodeReviewStore.setState({ selectedTaskId: 't1' })
    render(<ConversationTab />)

    expect(screen.getByText('Agent Notes')).toBeInTheDocument()
    expect(screen.getByText('Some important notes from the agent')).toBeInTheDocument()
  })

  it('shows placeholder when no spec', () => {
    sprintState.tasks = [
      {
        id: 't1',
        title: 'Task',
        spec: null,
        notes: null
      }
    ]
    useCodeReviewStore.setState({ selectedTaskId: 't1' })
    render(<ConversationTab />)

    expect(screen.getByText('No spec available')).toBeInTheDocument()
  })

  it('does not show agent notes section when notes are null', () => {
    sprintState.tasks = [
      {
        id: 't1',
        title: 'Task',
        spec: '## Spec',
        notes: null
      }
    ]
    useCodeReviewStore.setState({ selectedTaskId: 't1' })
    render(<ConversationTab />)

    expect(screen.queryByText('Agent Notes')).not.toBeInTheDocument()
  })

  it('shows placeholder when no task selected', () => {
    useCodeReviewStore.setState({ selectedTaskId: null })
    render(<ConversationTab />)

    expect(screen.getByText('No task selected')).toBeInTheDocument()
  })
})
