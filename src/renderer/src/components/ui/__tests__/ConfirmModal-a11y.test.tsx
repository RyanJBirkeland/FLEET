/**
 * Accessibility tests for ConfirmModal — verifies ARIA attributes and focus trap.
 * These tests complement ConfirmModal.test.tsx (which covers behavior/interaction).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfirmModal } from '../ConfirmModal'
import * as focusTrapModule from '../../../hooks/useFocusTrap'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      onKeyDown,
      role,
      'aria-modal': ariaModal,
      'aria-labelledby': ariaLabelledby,
      'aria-describedby': ariaDescribedby,
      className,
      ...rest
    }: any) => {
      const { createElement } = require('react')
      return createElement(
        'div',
        {
          onKeyDown,
          role,
          'aria-modal': ariaModal,
          'aria-labelledby': ariaLabelledby,
          'aria-describedby': ariaDescribedby,
          className,
          ref: rest.ref
        },
        children
      )
    }
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false
}))

vi.mock('../../../lib/motion', () => ({
  VARIANTS: { scaleIn: {} },
  SPRINGS: { snappy: {} },
  REDUCED_TRANSITION: { duration: 0 },
  useReducedMotion: () => false
}))

// Mock useFocusTrap to avoid DOM focus complications in unit tests
vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn()
}))

describe('ConfirmModal accessibility', () => {
  const defaultProps = {
    open: true,
    message: 'Are you sure?',
    onConfirm: vi.fn(),
    onCancel: vi.fn()
  }

  it('has role="alertdialog"', () => {
    render(<ConfirmModal {...defaultProps} />)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('has aria-modal="true"', () => {
    render(<ConfirmModal {...defaultProps} />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('has aria-describedby pointing to the message element', () => {
    render(<ConfirmModal {...defaultProps} />)
    const dialog = screen.getByRole('alertdialog')
    const describedby = dialog.getAttribute('aria-describedby')
    expect(describedby).toBeTruthy()
    expect(document.getElementById(describedby!)).toBeInTheDocument()
    expect(document.getElementById(describedby!)).toHaveTextContent('Are you sure?')
  })

  it('has aria-labelledby when title is provided', () => {
    render(<ConfirmModal {...defaultProps} title="Confirm Delete" />)
    const dialog = screen.getByRole('alertdialog')
    const labelledby = dialog.getAttribute('aria-labelledby')
    expect(labelledby).toBeTruthy()
    expect(document.getElementById(labelledby!)).toBeInTheDocument()
    expect(document.getElementById(labelledby!)).toHaveTextContent('Confirm Delete')
  })

  it('does not have aria-labelledby when title is not provided', () => {
    render(<ConfirmModal {...defaultProps} />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).not.toHaveAttribute('aria-labelledby')
  })

  it('calls useFocusTrap with open=true when modal is open', () => {
    const spy = vi.spyOn(focusTrapModule, 'useFocusTrap')
    render(<ConfirmModal {...defaultProps} open={true} />)
    expect(spy).toHaveBeenCalledWith(expect.anything(), true)
  })

  it('calls useFocusTrap with open=false when modal is closed', () => {
    const spy = vi.spyOn(focusTrapModule, 'useFocusTrap')
    render(<ConfirmModal {...defaultProps} open={false} />)
    expect(spy).toHaveBeenCalledWith(expect.anything(), false)
  })
})
