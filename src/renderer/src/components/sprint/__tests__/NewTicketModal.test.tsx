import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewTicketModal } from '../NewTicketModal'

describe('NewTicketModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onCreate: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when not open', () => {
    const { container } = render(<NewTicketModal {...defaultProps} open={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders title input, repo selector, priority selector, and spec textarea', () => {
    render(<NewTicketModal {...defaultProps} />)

    expect(screen.getByPlaceholderText(/Add recipe search/)).toBeInTheDocument()
    expect(screen.getByText('Repo')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
    expect(screen.getByText('Spec')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Write your spec in markdown or pick a template above...')
    ).toBeInTheDocument()
  })

  it('repo selector shows all valid repo options', () => {
    render(<NewTicketModal {...defaultProps} />)
    const options = screen.getAllByRole('option')
    const repoOptions = options.filter((o) =>
      ['BDE', 'life-os', 'feast'].includes(o.textContent ?? '')
    )
    expect(repoOptions).toHaveLength(3)
  })

  it('submit button disabled when title is empty', () => {
    render(<NewTicketModal {...defaultProps} />)
    const submitBtn = screen.getByRole('button', { name: 'Save to Backlog' })
    expect(submitBtn).toBeDisabled()
  })

  it('submit button enabled when title is filled', async () => {
    const user = userEvent.setup()
    render(<NewTicketModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText(/Add recipe search/), 'New feature')
    const submitBtn = screen.getByRole('button', { name: 'Save to Backlog' })
    expect(submitBtn).toBeEnabled()
  })

  it('calls onCreate with correct payload on submit', async () => {
    const user = userEvent.setup()
    render(<NewTicketModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText(/Add recipe search/), 'My task')
    await user.click(screen.getByRole('button', { name: 'Save to Backlog' }))

    expect(defaultProps.onCreate).toHaveBeenCalledWith({
      title: 'My task',
      repo: 'BDE',
      description: '',
      spec: '',
      priority: 1,
    })
  })

  it('closes modal after successful submit', async () => {
    const user = userEvent.setup()
    render(<NewTicketModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText(/Add recipe search/), 'My task')
    await user.click(screen.getByRole('button', { name: 'Save to Backlog' }))

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('Ask Paul button triggers invokeTool call', async () => {
    const mockInvoke = vi.mocked(window.api.invokeTool)
    mockInvoke.mockResolvedValue({
      ok: true,
      result: { content: [{ type: 'text', text: '## Generated Spec' }] },
    })

    const user = userEvent.setup()
    render(<NewTicketModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText(/Add recipe search/), 'Build feature X')

    const askPaulBtn = screen.getByRole('button', { name: 'Ask Paul' })
    await user.click(askPaulBtn)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'sessions_send',
        expect.objectContaining({
          sessionKey: 'main',
          timeoutSeconds: 30,
        })
      )
    })
  })

  it('Ask Paul button is disabled when title is empty', () => {
    render(<NewTicketModal {...defaultProps} />)
    const askPaulBtn = screen.getByRole('button', { name: 'Ask Paul' })
    expect(askPaulBtn).toBeDisabled()
  })

  it('populates spec textarea with AI-generated content', async () => {
    vi.mocked(window.api.invokeTool).mockResolvedValue({
      ok: true,
      result: { content: [{ type: 'text', text: '## AI Spec Content' }] },
    })

    const user = userEvent.setup()
    render(<NewTicketModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText(/Add recipe search/), 'Build feature X')
    await user.click(screen.getByRole('button', { name: 'Ask Paul' }))

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(
        'Write your spec in markdown or pick a template above...'
      ) as HTMLTextAreaElement
      expect(textarea.value).toBe('## AI Spec Content')
    })
  })

  it('template chip populates spec with template content', async () => {
    const user = userEvent.setup()
    render(<NewTicketModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Feature' }))

    const textarea = screen.getByPlaceholderText(
      'Write your spec in markdown or pick a template above...'
    ) as HTMLTextAreaElement
    expect(textarea.value).toContain('## Problem')
    expect(textarea.value).toContain('## Solution')
  })

  it('toggling same template chip clears spec', async () => {
    const user = userEvent.setup()
    render(<NewTicketModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Feature' }))
    await user.click(screen.getByRole('button', { name: 'Feature' }))

    const textarea = screen.getByPlaceholderText(
      'Write your spec in markdown or pick a template above...'
    ) as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })

  it('clears form when modal reopens', () => {
    const { rerender } = render(<NewTicketModal {...defaultProps} open={false} />)
    rerender(<NewTicketModal {...defaultProps} open={true} />)

    const titleInput = screen.getByPlaceholderText(/Add recipe search/) as HTMLInputElement
    expect(titleInput.value).toBe('')
  })
})
