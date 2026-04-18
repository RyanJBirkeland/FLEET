/**
 * ModelsSection — per-agent-type backend + model picker UI.
 * Loads `agents.backendConfig` on mount; composes the full BackendSettings
 * object on save.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../../../stores/toasts', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(window.api.settings.getJson).mockResolvedValue(null)
  vi.mocked(window.api.settings.setJson).mockResolvedValue(undefined)
})

import { ModelsSection } from '../ModelsSection'

describe('ModelsSection — scaffold', () => {
  it('renders the Local backend heading', () => {
    render(<ModelsSection />)
    expect(screen.getByText('Local backend')).toBeInTheDocument()
  })

  it('renders the endpoint text input with the default placeholder', () => {
    render(<ModelsSection />)
    const input = screen.getByPlaceholderText('http://localhost:1234/v1')
    expect(input).toBeInTheDocument()
  })

  it('populates the endpoint from loaded settings', async () => {
    vi.mocked(window.api.settings.getJson).mockResolvedValue({
      pipeline: { backend: 'claude', model: 'claude-sonnet-4-5' },
      synthesizer: { backend: 'claude', model: 'claude-sonnet-4-5' },
      copilot: { backend: 'claude', model: 'claude-sonnet-4-5' },
      assistant: { backend: 'claude', model: 'claude-sonnet-4-5' },
      adhoc: { backend: 'claude', model: 'claude-sonnet-4-5' },
      reviewer: { backend: 'claude', model: 'claude-sonnet-4-5' },
      localEndpoint: 'http://localhost:9999/v1'
    })
    render(<ModelsSection />)
    await waitFor(() => {
      expect(screen.getByDisplayValue('http://localhost:9999/v1')).toBeInTheDocument()
    })
  })
})
