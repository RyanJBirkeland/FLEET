import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingWizard } from '../OnboardingWizard'

describe('OnboardingWizard', () => {
  it('renders Welcome step initially', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    expect(screen.getByText(/welcome to bde/i)).toBeInTheDocument()
  })

  it('navigates through steps with Next button', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard onComplete={vi.fn()} />)

    // Step 1: Welcome
    expect(screen.getByText(/welcome to bde/i)).toBeInTheDocument()

    // Navigate to step 2
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/claude authentication/i)).toBeInTheDocument()

    // Navigate to step 3
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('heading', { name: /git setup/i })).toBeInTheDocument()

    // Navigate to step 4
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('heading', { name: /repository configuration/i })).toBeInTheDocument()

    // Navigate to step 5
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('heading', { name: /you're ready/i })).toBeInTheDocument()
  })

  it('calls onComplete on final step', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<OnboardingWizard onComplete={onComplete} />)

    // Click through all 5 steps
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole('button', { name: /next/i }))
    }

    // Final step - click "Get Started"
    await user.click(screen.getByRole('button', { name: /get started/i }))
    expect(onComplete).toHaveBeenCalled()
  })

  it('allows back navigation', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard onComplete={vi.fn()} />)

    // Go to step 2
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/claude authentication/i)).toBeInTheDocument()

    // Go back to step 1
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText(/welcome to bde/i)).toBeInTheDocument()
  })

  it('shows progress indicators for all steps', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)

    // Should show 5 step indicators
    const stepIndicators = screen.getAllByTestId(/step-indicator-\d/)
    expect(stepIndicators).toHaveLength(5)
  })
})
