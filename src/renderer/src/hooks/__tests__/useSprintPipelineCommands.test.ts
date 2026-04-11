import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSprintPipelineCommands } from '../useSprintPipelineCommands'
import { useCommandPaletteStore } from '../../stores/commandPalette'

vi.mock('../../stores/commandPalette')
vi.mock('../../stores/sprintTasks')
vi.mock('../../stores/toasts')

describe('useSprintPipelineCommands', () => {
  const mockRegisterCommands = vi.fn()
  const mockUnregisterCommands = vi.fn()
  const mockOpenWorkbench = vi.fn()
  const mockHandleStop = vi.fn()
  const mockHandleRetry = vi.fn()
  const mockSetStatusFilter = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCommandPaletteStore).mockImplementation((selector: any) => {
      const store = {
        registerCommands: mockRegisterCommands,
        unregisterCommands: mockUnregisterCommands
      }
      return selector(store)
    })
  })

  it('registers all expected commands on mount', () => {
    renderHook(() =>
      useSprintPipelineCommands({
        openWorkbench: mockOpenWorkbench,
        handleStop: mockHandleStop,
        handleRetry: mockHandleRetry,
        setStatusFilter: mockSetStatusFilter
      })
    )

    expect(mockRegisterCommands).toHaveBeenCalledTimes(1)
    const commands = mockRegisterCommands.mock.calls[0][0]

    // Verify all 11 commands are registered (3 task + 8 filter)
    expect(commands).toHaveLength(11)

    // Verify task commands
    const taskCommandIds = commands.filter((c: any) => c.category === 'task').map((c: any) => c.id)
    expect(taskCommandIds).toEqual(['task-create', 'task-stop-active', 'task-retry-failed'])

    // Verify filter commands
    const filterCommandIds = commands
      .filter((c: any) => c.category === 'filter')
      .map((c: any) => c.id)
    expect(filterCommandIds).toEqual([
      'filter-all',
      'filter-backlog',
      'filter-todo',
      'filter-blocked',
      'filter-active',
      'filter-review',
      'filter-done',
      'filter-failed'
    ])
  })

  it('unregisters all commands on unmount', () => {
    const { unmount } = renderHook(() =>
      useSprintPipelineCommands({
        openWorkbench: mockOpenWorkbench,
        handleStop: mockHandleStop,
        handleRetry: mockHandleRetry,
        setStatusFilter: mockSetStatusFilter
      })
    )

    unmount()

    expect(mockUnregisterCommands).toHaveBeenCalledTimes(1)
    const commandIds = mockUnregisterCommands.mock.calls[0][0]

    // Verify all 11 command IDs are unregistered
    expect(commandIds).toHaveLength(11)
    expect(commandIds).toContain('task-create')
    expect(commandIds).toContain('task-stop-active')
    expect(commandIds).toContain('task-retry-failed')
    expect(commandIds).toContain('filter-all')
    expect(commandIds).toContain('filter-backlog')
    expect(commandIds).toContain('filter-todo')
    expect(commandIds).toContain('filter-blocked')
    expect(commandIds).toContain('filter-active')
    expect(commandIds).toContain('filter-review')
    expect(commandIds).toContain('filter-done')
    expect(commandIds).toContain('filter-failed')
  })

  it('calls openWorkbench when task-create command is executed', () => {
    renderHook(() =>
      useSprintPipelineCommands({
        openWorkbench: mockOpenWorkbench,
        handleStop: mockHandleStop,
        handleRetry: mockHandleRetry,
        setStatusFilter: mockSetStatusFilter
      })
    )

    const commands = mockRegisterCommands.mock.calls[0][0]
    const taskCreateCommand = commands.find((c: any) => c.id === 'task-create')

    taskCreateCommand.action()
    expect(mockOpenWorkbench).toHaveBeenCalledTimes(1)
  })

  it('calls setStatusFilter when filter commands are executed', () => {
    renderHook(() =>
      useSprintPipelineCommands({
        openWorkbench: mockOpenWorkbench,
        handleStop: mockHandleStop,
        handleRetry: mockHandleRetry,
        setStatusFilter: mockSetStatusFilter
      })
    )

    const commands = mockRegisterCommands.mock.calls[0][0]
    const filterAllCommand = commands.find((c: any) => c.id === 'filter-all')
    const filterBacklogCommand = commands.find((c: any) => c.id === 'filter-backlog')

    filterAllCommand.action()
    expect(mockSetStatusFilter).toHaveBeenCalledWith('all')

    filterBacklogCommand.action()
    expect(mockSetStatusFilter).toHaveBeenCalledWith('backlog')
  })
})
