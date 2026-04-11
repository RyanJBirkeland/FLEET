import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AIFileStatusBadge } from './AIFileStatusBadge'

describe('AIFileStatusBadge', () => {
  it('renders a warning indicator for issues status', () => {
    render(<AIFileStatusBadge status="issues" />)
    expect(screen.getByRole('img', { name: /file has issues/i })).toBeInTheDocument()
  })

  it('renders a check indicator for clean status', () => {
    render(<AIFileStatusBadge status="clean" />)
    expect(screen.getByRole('img', { name: /file reviewed clean/i })).toBeInTheDocument()
  })

  it('renders nothing for unreviewed status', () => {
    const { container } = render(<AIFileStatusBadge status="unreviewed" />)
    expect(container.firstChild).toBeNull()
  })
})
