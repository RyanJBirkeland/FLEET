/**
 * StatusPill — status indicator badge.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { StatusPill } from '../StatusPill'

describe('StatusPill', () => {
  it('renders label text', () => {
    render(<StatusPill label="Connected" variant="success" />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('applies variant class', () => {
    const { container } = render(<StatusPill label="Error" variant="error" />)
    const pill = container.querySelector('.bde-badge')
    expect(pill).toHaveClass('bde-badge--danger')
  })

  it('applies success variant class', () => {
    const { container } = render(<StatusPill label="OK" variant="success" />)
    const pill = container.querySelector('.bde-badge')
    expect(pill).toHaveClass('bde-badge--success')
  })

  it('applies info variant class', () => {
    const { container } = render(<StatusPill label="Info" variant="info" />)
    const pill = container.querySelector('.bde-badge')
    expect(pill).toHaveClass('bde-badge--info')
  })

  it('applies warning variant class', () => {
    const { container } = render(<StatusPill label="Warning" variant="warning" />)
    const pill = container.querySelector('.bde-badge')
    expect(pill).toHaveClass('bde-badge--warning')
  })

  it('applies neutral variant class', () => {
    const { container } = render(<StatusPill label="Neutral" variant="neutral" />)
    const pill = container.querySelector('.bde-badge')
    expect(pill).toHaveClass('bde-badge--muted')
  })

  it('renders green dot before label for success variant', () => {
    const { container } = render(<StatusPill label="Active" variant="success" />)
    const dot = container.querySelector('.bde-badge__dot')
    expect(dot).toBeInTheDocument()
  })

  it('does not render green dot for non-success variants', () => {
    const { container } = render(<StatusPill label="Pending" variant="warning" />)
    const dot = container.querySelector('.bde-badge__dot')
    expect(dot).not.toBeInTheDocument()
  })
})
