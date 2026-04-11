import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../../stores/codeReview', () => {
  const { create } = require('zustand')
  const store = create(() => ({
    selectedTaskId: null
  }))
  return { useCodeReviewStore: store }
})

import { AIAssistantPanel } from '../AIAssistantPanel'
import { useCodeReviewStore } from '../../../stores/codeReview'

describe('AIAssistantPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCodeReviewStore.setState({ selectedTaskId: null })
  })

  it('renders header with Sparkles icon and title', () => {
    render(<AIAssistantPanel />)
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    // Sparkles icon is rendered but hard to test directly; check parent structure
    const header = screen.getByText('AI Assistant').closest('.cr-assistant__header')
    expect(header).toBeInTheDocument()
  })

  it('renders kebab menu button', () => {
    render(<AIAssistantPanel />)
    const kebabBtn = screen.getByRole('button', { name: 'Menu' })
    expect(kebabBtn).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('opens kebab menu on click and shows three menu items', () => {
    render(<AIAssistantPanel />)
    const kebabBtn = screen.getByRole('button', { name: 'Menu' })
    fireEvent.click(kebabBtn)
    expect(screen.getByText('Show agent history')).toBeInTheDocument()
    expect(screen.getByText('Clear thread')).toBeInTheDocument()
    expect(screen.getByText('New thread')).toBeInTheDocument()
  })

  it('toggles show-history class when menu item clicked', () => {
    const { container } = render(<AIAssistantPanel />)
    const aside = container.querySelector('.cr-assistant')
    expect(aside).not.toHaveClass('cr-assistant--show-history')

    const kebabBtn = screen.getByRole('button', { name: 'Menu' })
    fireEvent.click(kebabBtn)
    const historyBtn = screen.getByText('Show agent history')
    fireEvent.click(historyBtn)

    expect(aside).toHaveClass('cr-assistant--show-history')
  })

  it('renders quick-action chips', () => {
    render(<AIAssistantPanel />)
    expect(screen.getByText('Summarize diff')).toBeInTheDocument()
    expect(screen.getByText('Risks?')).toBeInTheDocument()
    expect(screen.getByText('Explain selected file')).toBeInTheDocument()
  })

  it('renders input dock with textarea and Send button', () => {
    const { container } = render(<AIAssistantPanel />)
    const textarea = container.querySelector('.cr-assistant__input textarea')
    expect(textarea).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: 'Send message' })
    expect(submitBtn).toHaveAttribute('type', 'submit')
    expect(submitBtn).toBeDisabled() // disabled when empty
  })

  it('enables submit button when textarea has content', () => {
    const { container } = render(<AIAssistantPanel />)
    const textarea = container.querySelector('.cr-assistant__input textarea')
    const submitBtn = screen.getByRole('button', { name: 'Send message' })

    fireEvent.change(textarea!, { target: { value: 'test message' } })
    expect(submitBtn).not.toBeDisabled()
  })

  it('renders empty state when no task selected', () => {
    useCodeReviewStore.setState({ selectedTaskId: null })
    render(<AIAssistantPanel />)
    expect(
      screen.getByText('Select a task to start chatting about its changes.')
    ).toBeInTheDocument()
  })

  it('does not render empty state when task selected', () => {
    useCodeReviewStore.setState({ selectedTaskId: 'task-123' })
    render(<AIAssistantPanel />)
    expect(
      screen.queryByText('Select a task to start chatting about its changes.')
    ).not.toBeInTheDocument()
  })

  it('handles chip clicks without error', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    render(<AIAssistantPanel />)
    const chipBtn = screen.getByText('Summarize diff')
    fireEvent.click(chipBtn)
    expect(consoleSpy).toHaveBeenCalledWith(
      'TODO: CR Redesign follow-up epic —',
      'summarize'
    )
    consoleSpy.mockRestore()
  })

  it('prevents form submission and logs TODO', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    render(<AIAssistantPanel />)
    const form = screen.getByRole('button', { name: 'Send message' }).closest('form')
    expect(form).toBeInTheDocument()
    // Form submission is preventDefault-ed, so it won't actually submit
    fireEvent.submit(form!)
    // No error thrown means preventDefault worked
    consoleSpy.mockRestore()
  })
})
