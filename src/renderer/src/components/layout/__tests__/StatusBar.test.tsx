import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '../StatusBar'

describe('StatusBar', () => {
  it('shows model name', () => {
    render(<StatusBar model="opus" />)
    expect(screen.getByText('opus')).toBeInTheDocument()
  })

  it('shows Local badge', () => {
    render(<StatusBar model="sonnet" />)
    expect(screen.getByText('Local')).toBeInTheDocument()
  })
})
