/**
 * Tests for AddEpicDependencyModal component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddEpicDependencyModal } from '../AddEpicDependencyModal'
import type { TaskGroup } from '../../../../../shared/types'

describe('AddEpicDependencyModal', () => {
  const currentEpic: TaskGroup = {
    id: 'epic-1',
    name: 'Current Epic',
    icon: 'C',
    accent_color: '#00ff00',
    goal: 'Current',
    status: 'draft',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    depends_on: [{ id: 'epic-3', condition: 'on_success' }]
  }

  const epic2: TaskGroup = {
    id: 'epic-2',
    name: 'Epic Two',
    icon: 'E',
    accent_color: '#ff0000',
    goal: 'Two',
    status: 'ready',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    depends_on: null
  }

  const epic3: TaskGroup = {
    id: 'epic-3',
    name: 'Epic Three',
    icon: 'T',
    accent_color: '#0000ff',
    goal: 'Three',
    status: 'ready',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    depends_on: null
  }

  const epic4: TaskGroup = {
    id: 'epic-4',
    name: 'Epic Four (would cycle)',
    icon: 'F',
    accent_color: '#ffff00',
    goal: 'Four',
    status: 'ready',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    depends_on: [{ id: 'epic-1', condition: 'on_success' }]
  }

  const allGroups: TaskGroup[] = [currentEpic, epic2, epic3, epic4]

  const mockHandlers = {
    onClose: vi.fn(),
    onAdd: vi.fn().mockResolvedValue(undefined)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when closed', () => {
    render(
      <AddEpicDependencyModal
        open={false}
        currentEpic={currentEpic}
        allGroups={allGroups}
        {...mockHandlers}
      />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    render(
      <AddEpicDependencyModal
        open={true}
        currentEpic={currentEpic}
        allGroups={allGroups}
        {...mockHandlers}
      />
    )

    expect(screen.getByRole('dialog', { name: /add epic dependency/i })).toBeInTheDocument()
  })

  it('excludes self from epic picker', () => {
    render(
      <AddEpicDependencyModal
        open={true}
        currentEpic={currentEpic}
        allGroups={allGroups}
        {...mockHandlers}
      />
    )

    const select = screen.getByRole('combobox', { name: /upstream epic/i })
    const options = Array.from(select.querySelectorAll('option'))
      .map((opt) => opt.textContent)
      .filter(Boolean)

    expect(options).not.toContain('Current Epic')
  })

  it('disables already-existing dependencies', () => {
    render(
      <AddEpicDependencyModal
        open={true}
        currentEpic={currentEpic}
        allGroups={allGroups}
        {...mockHandlers}
      />
    )

    const select = screen.getByRole('combobox', { name: /upstream epic/i })
    const epic3Option = Array.from(select.querySelectorAll('option')).find((opt) =>
      opt.textContent?.includes('Epic Three')
    )

    expect(epic3Option).toHaveProperty('disabled', true)
  })

  it('disables options that would create a cycle', () => {
    render(
      <AddEpicDependencyModal
        open={true}
        currentEpic={currentEpic}
        allGroups={allGroups}
        {...mockHandlers}
      />
    )

    const select = screen.getByRole('combobox', { name: /upstream epic/i })
    const epic4Option = Array.from(select.querySelectorAll('option')).find((opt) =>
      opt.textContent?.includes('Epic Four')
    )

    expect(epic4Option).toHaveProperty('disabled', true)
  })

  it('defaults to on_success condition', () => {
    render(
      <AddEpicDependencyModal
        open={true}
        currentEpic={currentEpic}
        allGroups={allGroups}
        {...mockHandlers}
      />
    )

    const onSuccessRadio = screen.getByRole('radio', { name: /on success/i })
    expect(onSuccessRadio).toBeChecked()
  })

  it('calls onAdd with selected epic and condition', async () => {
    const user = userEvent.setup()
    render(
      <AddEpicDependencyModal
        open={true}
        currentEpic={currentEpic}
        allGroups={allGroups}
        {...mockHandlers}
      />
    )

    // Select Epic Two
    const select = screen.getByRole('combobox', { name: /upstream epic/i })
    await user.selectOptions(select, 'epic-2')

    // Change condition to manual
    const manualRadio = screen.getByRole('radio', { name: /manual checkpoint/i })
    await user.click(manualRadio)

    // Submit
    const addButton = screen.getByRole('button', { name: /^add$/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(mockHandlers.onAdd).toHaveBeenCalledWith({ id: 'epic-2', condition: 'manual' })
    })
  })

  it('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup()
    render(
      <AddEpicDependencyModal
        open={true}
        currentEpic={currentEpic}
        allGroups={allGroups}
        {...mockHandlers}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockHandlers.onClose).toHaveBeenCalled()
  })

  it('disables add button when no epic selected', () => {
    render(
      <AddEpicDependencyModal
        open={true}
        currentEpic={currentEpic}
        allGroups={allGroups}
        {...mockHandlers}
      />
    )

    const addButton = screen.getByRole('button', { name: /^add$/i })
    expect(addButton).toBeDisabled()
  })

  it('closes modal on successful add', async () => {
    const user = userEvent.setup()
    render(
      <AddEpicDependencyModal
        open={true}
        currentEpic={currentEpic}
        allGroups={allGroups}
        {...mockHandlers}
      />
    )

    const select = screen.getByRole('combobox', { name: /upstream epic/i })
    await user.selectOptions(select, 'epic-2')

    const addButton = screen.getByRole('button', { name: /^add$/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(mockHandlers.onClose).toHaveBeenCalled()
    })
  })
})
