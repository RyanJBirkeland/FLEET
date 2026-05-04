import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip } from '../Tooltip'

describe('Tooltip', () => {
  it('renders children', () => {
    render(<Tooltip content="Hint">Hover me</Tooltip>)
    expect(screen.getByText('Hover me')).toBeInTheDocument()
  })

  it('exposes tooltip content via role="tooltip"', () => {
    render(<Tooltip content="Hint text">Child</Tooltip>)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hint text')
  })

  it('links trigger to tooltip via aria-describedby', () => {
    const { container } = render(<Tooltip content="Hint text">Child</Tooltip>)
    const trigger = container.firstChild as HTMLElement
    const tooltip = screen.getByRole('tooltip')
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id)
  })

  it('applies top side class by default', () => {
    const { container } = render(<Tooltip content="Hint">Child</Tooltip>)
    expect(container.firstChild).toHaveClass('fleet-tooltip--top')
  })

  it('applies custom side class', () => {
    const { container } = render(
      <Tooltip content="Hint" side="bottom">
        Child
      </Tooltip>
    )
    expect(container.firstChild).toHaveClass('fleet-tooltip--bottom')
  })
})
