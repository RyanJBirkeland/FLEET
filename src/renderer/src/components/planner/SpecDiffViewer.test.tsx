import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpecDiffViewer } from './SpecDiffViewer'

describe('SpecDiffViewer', () => {
  it('renders collapsed by default with a show-changes button', () => {
    render(<SpecDiffViewer oldSpec="## Goal\nOld content" newSpec="## Goal\nNew content" />)
    expect(screen.getByRole('button', { name: /show changes/i })).toBeInTheDocument()
    expect(screen.queryByTestId('spec-diff-lines')).not.toBeInTheDocument()
  })

  it('expands when show-changes is clicked', async () => {
    render(<SpecDiffViewer oldSpec="## Goal\nOld content" newSpec="## Goal\nNew content" />)
    await userEvent.click(screen.getByRole('button', { name: /show changes/i }))
    expect(screen.getByTestId('spec-diff-lines')).toBeInTheDocument()
  })

  it('shows add and del line classes when expanded', async () => {
    render(<SpecDiffViewer oldSpec="removed line" newSpec="added line" />)
    await userEvent.click(screen.getByRole('button', { name: /show changes/i }))
    const lines = screen.getByTestId('spec-diff-lines')
    expect(lines.querySelector('.edit-diff-card__row--del')).toBeTruthy()
    expect(lines.querySelector('.edit-diff-card__row--add')).toBeTruthy()
  })

  it('collapses when hide-changes is clicked', async () => {
    render(<SpecDiffViewer oldSpec="old" newSpec="new" />)
    await userEvent.click(screen.getByRole('button', { name: /show changes/i }))
    await userEvent.click(screen.getByRole('button', { name: /hide changes/i }))
    expect(screen.queryByTestId('spec-diff-lines')).not.toBeInTheDocument()
  })

  it('renders all additions when oldSpec is null', async () => {
    render(<SpecDiffViewer oldSpec={null} newSpec="brand new spec line" />)
    await userEvent.click(screen.getByRole('button', { name: /show changes/i }))
    const lines = screen.getByTestId('spec-diff-lines')
    expect(lines.querySelector('.edit-diff-card__row--add')).toBeTruthy()
    expect(lines.querySelector('.edit-diff-card__row--del')).toBeNull()
  })
})
