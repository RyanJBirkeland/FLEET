import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditDiffCard } from '../EditDiffCard'

describe('EditDiffCard', () => {
  it('renders null for undefined input', () => {
    const { container } = render(<EditDiffCard input={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null for non-object input', () => {
    const { container } = render(<EditDiffCard input="string" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders diff for edit tool with old_string and new_string', () => {
    const input = {
      file_path: 'test.ts',
      old_string: 'const old = 1',
      new_string: 'const new = 2'
    }
    render(<EditDiffCard input={input} />)
    const card = document.querySelector('.edit-diff-card')
    expect(card).toBeTruthy()

    // Should have diff rows
    const addRows = document.querySelectorAll('.edit-diff-card__row--add')
    const delRows = document.querySelectorAll('.edit-diff-card__row--del')
    expect(addRows.length).toBeGreaterThan(0)
    expect(delRows.length).toBeGreaterThan(0)
  })

  it('renders code block for write tool with content', () => {
    const input = {
      file_path: 'new-file.ts',
      content: 'const a = 1\nconst b = 2'
    }
    render(<EditDiffCard input={input} />)
    const card = document.querySelector('.edit-diff-card')
    expect(card).toBeTruthy()

    // Should have context rows (no add/del styling for write)
    const rows = document.querySelectorAll('.edit-diff-card__row')
    expect(rows.length).toBe(2) // 2 lines

    // Line numbers should be sequential
    const lineNos = document.querySelectorAll('.edit-diff-card__line-no')
    expect(lineNos[0].textContent).toBe('1')
    expect(lineNos[1].textContent).toBe('2')
  })

  it('renders null when input has neither old_string/new_string nor content', () => {
    const input = {
      file_path: 'test.ts'
    }
    const { container } = render(<EditDiffCard input={input} />)
    expect(container.firstChild).toBeNull()
  })

  it('handles multi-line edit diffs', () => {
    const input = {
      file_path: 'multi.ts',
      old_string: 'line 1\nline 2\nline 3',
      new_string: 'line 1\nmodified line 2\nline 3'
    }
    render(<EditDiffCard input={input} />)

    const addRows = document.querySelectorAll('.edit-diff-card__row--add')
    const delRows = document.querySelectorAll('.edit-diff-card__row--del')

    // Should have deletions for all old lines and additions for all new lines
    expect(delRows.length).toBe(3)
    expect(addRows.length).toBe(3)
  })

  it('renders content correctly in code block rows', () => {
    const input = {
      content: 'function test() { return 42; }'
    }
    render(<EditDiffCard input={input} />)

    const content = screen.getByText('function test() { return 42; }')
    expect(content).toBeTruthy()
  })
})
