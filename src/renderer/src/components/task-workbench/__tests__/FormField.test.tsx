import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormField } from '../FormField'

describe('FormField', () => {
  it('renders label and children', () => {
    render(
      <FormField label="Test Label" htmlFor="test-input">
        <input id="test-input" type="text" />
      </FormField>
    )
    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('associates label with input via htmlFor', () => {
    render(
      <FormField label="Email" htmlFor="email-field">
        <input id="email-field" type="email" />
      </FormField>
    )
    const label = screen.getByText('Email')
    expect(label).toHaveAttribute('for', 'email-field')
  })

  it('applies default className when not provided', () => {
    const { container } = render(
      <FormField label="Default" htmlFor="default-input">
        <input id="default-input" type="text" />
      </FormField>
    )
    const wrapper = container.querySelector('.wb-form__field')
    expect(wrapper).toBeInTheDocument()
  })

  it('applies custom className when provided', () => {
    const { container } = render(
      <FormField label="Custom" htmlFor="custom-input" className="custom-class">
        <input id="custom-input" type="text" />
      </FormField>
    )
    const wrapper = container.querySelector('.custom-class')
    expect(wrapper).toBeInTheDocument()
  })

  it('renders select elements as children', () => {
    render(
      <FormField label="Priority" htmlFor="priority-select">
        <select id="priority-select">
          <option value="1">High</option>
          <option value="2">Low</option>
        </select>
      </FormField>
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('renders textarea elements as children', () => {
    render(
      <FormField label="Description" htmlFor="desc-textarea">
        <textarea id="desc-textarea" />
      </FormField>
    )
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('applies wb-form__label class to label', () => {
    render(
      <FormField label="Styled Label" htmlFor="styled-input">
        <input id="styled-input" type="text" />
      </FormField>
    )
    const label = screen.getByText('Styled Label')
    expect(label).toHaveClass('wb-form__label')
  })
})
