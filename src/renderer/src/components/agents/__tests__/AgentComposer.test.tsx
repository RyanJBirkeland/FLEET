import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentComposer } from '../AgentComposer'

// Mock CommandBar since it has complex deps
vi.mock('../CommandBar', () => ({
  CommandBar: ({ disabled }: { disabled: boolean }) => (
    <div data-testid="command-bar" data-disabled={disabled} />
  ),
}))

describe('AgentComposer', () => {
  it('renders the command bar', () => {
    render(<AgentComposer onSend={vi.fn()} onCommand={vi.fn()} disabled={false} streaming={false} />)
    expect(screen.getByTestId('command-bar')).toBeDefined()
  })

  it('disables command bar when streaming', () => {
    render(<AgentComposer onSend={vi.fn()} onCommand={vi.fn()} disabled={false} streaming={true} />)
    expect(screen.getByTestId('command-bar').getAttribute('data-disabled')).toBe('true')
  })

  it('disables command bar when disabled prop is true', () => {
    render(<AgentComposer onSend={vi.fn()} onCommand={vi.fn()} disabled={true} streaming={false} />)
    expect(screen.getByTestId('command-bar').getAttribute('data-disabled')).toBe('true')
  })

  it('shows model info when provided', () => {
    render(<AgentComposer onSend={vi.fn()} onCommand={vi.fn()} disabled={false} streaming={false} model="claude-haiku-4-5" tokensUsed={10000} tokensMax={200000} />)
    expect(screen.getByText(/claude-haiku-4-5/)).toBeDefined()
  })
})
