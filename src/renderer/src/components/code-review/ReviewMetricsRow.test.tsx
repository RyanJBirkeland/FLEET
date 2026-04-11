import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReviewMetricsRow } from './ReviewMetricsRow'

describe('ReviewMetricsRow', () => {
  it('renders all three metrics with accessible labels', () => {
    render(<ReviewMetricsRow qualityScore={92} issuesCount={3} filesCount={8} />)
    expect(screen.getByLabelText(/quality score 92/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/3 issues found/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/8 files changed/i)).toBeInTheDocument()
  })

  it('renders loading placeholders when metrics are undefined', () => {
    render(<ReviewMetricsRow loading />)
    const placeholders = screen.getAllByText('—')
    expect(placeholders.length).toBe(3)
  })
})
