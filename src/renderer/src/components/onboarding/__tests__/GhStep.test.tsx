import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GhStep } from '../steps/GhStep'

const stepProps = {
  onNext: vi.fn(),
  onBack: vi.fn(),
  onComplete: vi.fn(),
  isFirst: false,
  isLast: false
}

function mockGh(result: { available: boolean; authenticated: boolean; version?: string }): void {
  const api = (globalThis as unknown as { api: Record<string, unknown> }).api
  const onboarding = api.onboarding as { checkGhCli: ReturnType<typeof vi.fn> }
  onboarding.checkGhCli = vi.fn().mockResolvedValue(result)
}

function settingsSet(): ReturnType<typeof vi.fn> {
  const api = (globalThis as unknown as { api: Record<string, unknown> }).api
  const settings = api.settings as { set: ReturnType<typeof vi.fn> }
  settings.set = vi.fn().mockResolvedValue(undefined)
  return settings.set
}

describe('GhStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enables Next when CLI + auth both pass', async () => {
    mockGh({ available: true, authenticated: true, version: 'gh version 2.42.0' })
    settingsSet()
    render(<GhStep {...stepProps} />)

    const nextBtn = await screen.findByRole('button', { name: /next/i })
    await waitFor(() => expect(nextBtn).not.toBeDisabled())
  })

  it('shows copy-pasteable gh auth login when CLI is present but not authenticated', async () => {
    mockGh({ available: true, authenticated: false, version: 'gh version 2.42.0' })
    settingsSet()
    render(<GhStep {...stepProps} />)

    const copyBtn = await screen.findByRole('button', { name: /copy command to clipboard/i })
    expect(copyBtn).toBeInTheDocument()
    expect(screen.getByText(/gh auth login/i)).toBeInTheDocument()
  })

  it('renders a Skip button and writes githubOptedOut=true when clicked', async () => {
    mockGh({ available: true, authenticated: false, version: 'gh version 2.42.0' })
    const setMock = settingsSet()
    const onNext = vi.fn()
    const user = userEvent.setup()

    render(<GhStep {...stepProps} onNext={onNext} />)

    const skipBtn = await screen.findByRole('button', { name: /skip — read-only mode/i })
    await user.click(skipBtn)

    await waitFor(() => {
      expect(setMock).toHaveBeenCalledWith('githubOptedOut', 'true')
      expect(onNext).toHaveBeenCalled()
    })
  })

  it('writes githubOptedOut=false on Next so re-running onboarding can clear opt-out', async () => {
    mockGh({ available: true, authenticated: true })
    const setMock = settingsSet()
    const onNext = vi.fn()
    const user = userEvent.setup()

    render(<GhStep {...stepProps} onNext={onNext} />)

    const nextBtn = await screen.findByRole('button', { name: /^next$/i })
    await waitFor(() => expect(nextBtn).not.toBeDisabled())
    await user.click(nextBtn)

    await waitFor(() => {
      expect(setMock).toHaveBeenCalledWith('githubOptedOut', 'false')
      expect(onNext).toHaveBeenCalled()
    })
  })
})
