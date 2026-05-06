/**
 * PipelineStageV2 — keyboard navigation and resolveBlockingTitles unit tests.
 *
 * The keyboard handler uses querySelectorAll('[role="button"], button') inside the
 * cards container ref. We mock TaskPillV2 to render actual <button> elements so
 * the focus movement can be exercised without the full component tree.
 *
 * resolveBlockingTitles is private to the module, so we verify its output through
 * the blockingTitles prop that PipelineStageV2 passes to TaskPillV2.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SprintTask } from '../../../../../shared/types'
import { nowIso } from '../../../../../shared/time'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...rest }: any) => <div {...rest}>{children}</div> }
}))

// Capture blockingTitles passed from PipelineStageV2 to TaskPillV2
const capturedBlockingTitles: Array<string | null> = []

vi.mock('../TaskPillV2', () => ({
  TaskPillV2: ({ task, onClick, blockingTitles }: any) => {
    capturedBlockingTitles.push(blockingTitles ?? null)
    return (
      <button role="button" data-testid={`pill-${task.id}`} onClick={() => onClick(task.id)}>
        {task.title}
      </button>
    )
  }
}))

vi.mock('../TaskRowV2', () => ({
  TaskRowV2: ({ task, onClick }: any) => (
    <button data-testid={`row-${task.id}`} onClick={() => onClick(task.id)}>
      {task.title}
    </button>
  )
}))

vi.mock('../../../stores/sprintUI', () => ({
  useSprintUI: vi.fn((sel: any) => sel({ pipelineDensity: 'card' }))
}))

function makeTask(overrides: Partial<SprintTask> = {}): SprintTask {
  return {
    id: crypto.randomUUID(),
    title: 'Test task',
    repo: 'fleet',
    prompt: null,
    priority: 1,
    status: 'queued',
    notes: null,
    spec: null,
    agent_run_id: null,
    pr_number: null,
    pr_status: null,
    pr_mergeable_state: null,
    pr_url: null,
    stacked_on_task_id: null,
    claimed_by: null,
    started_at: null,
    completed_at: null,
    retry_count: 0,
    fast_fail_count: 0,
    template_name: null,
    depends_on: null,
    updated_at: nowIso(),
    created_at: nowIso(),
    ...overrides
  }
}

import { PipelineStageV2 } from '../PipelineStageV2'

const DEFAULT_PROPS = {
  name: 'queued' as const,
  label: 'Queued',
  count: '3',
  selectedTaskId: null,
  onTaskClick: vi.fn()
}

function getStageBody(anyCardInStage: HTMLElement): HTMLElement {
  // The keyboard handler is attached to the cards container div (ref=cardsRef).
  // It is the direct parent of the pill buttons.
  return anyCardInStage.parentElement as HTMLElement
}

describe('PipelineStageV2 — keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedBlockingTitles.length = 0
  })

  it('moves focus to the next card on ArrowDown', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'Task A' }),
      makeTask({ id: 'b', title: 'Task B' }),
      makeTask({ id: 'c', title: 'Task C' })
    ]
    render(<PipelineStageV2 {...DEFAULT_PROPS} tasks={tasks} />)

    const cardA = screen.getByTestId('pill-a')
    const cardB = screen.getByTestId('pill-b')

    cardA.focus()
    expect(document.activeElement).toBe(cardA)

    fireEvent.keyDown(getStageBody(cardA), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cardB)
  })

  it('moves focus to the previous card on ArrowUp', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'Task A' }),
      makeTask({ id: 'b', title: 'Task B' }),
      makeTask({ id: 'c', title: 'Task C' })
    ]
    render(<PipelineStageV2 {...DEFAULT_PROPS} tasks={tasks} />)

    const cardA = screen.getByTestId('pill-a')
    const cardB = screen.getByTestId('pill-b')

    cardB.focus()
    expect(document.activeElement).toBe(cardB)

    fireEvent.keyDown(getStageBody(cardB), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(cardA)
  })

  it('moves focus to the first card on Home', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'Task A' }),
      makeTask({ id: 'b', title: 'Task B' }),
      makeTask({ id: 'c', title: 'Task C' })
    ]
    render(<PipelineStageV2 {...DEFAULT_PROPS} tasks={tasks} />)

    const cardA = screen.getByTestId('pill-a')
    const cardC = screen.getByTestId('pill-c')

    cardC.focus()
    fireEvent.keyDown(getStageBody(cardC), { key: 'Home' })
    expect(document.activeElement).toBe(cardA)
  })

  it('moves focus to the last card on End', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'Task A' }),
      makeTask({ id: 'b', title: 'Task B' }),
      makeTask({ id: 'c', title: 'Task C' })
    ]
    render(<PipelineStageV2 {...DEFAULT_PROPS} tasks={tasks} />)

    const cardA = screen.getByTestId('pill-a')
    const cardC = screen.getByTestId('pill-c')

    cardA.focus()
    fireEvent.keyDown(getStageBody(cardA), { key: 'End' })
    expect(document.activeElement).toBe(cardC)
  })

  it('does not move focus past the last card on ArrowDown', () => {
    const tasks = [makeTask({ id: 'a', title: 'Task A' }), makeTask({ id: 'b', title: 'Task B' })]
    render(<PipelineStageV2 {...DEFAULT_PROPS} tasks={tasks} />)

    const cardB = screen.getByTestId('pill-b')
    cardB.focus()

    fireEvent.keyDown(getStageBody(cardB), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cardB)
  })

  it('does not move focus before the first card on ArrowUp', () => {
    const tasks = [makeTask({ id: 'a', title: 'Task A' }), makeTask({ id: 'b', title: 'Task B' })]
    render(<PipelineStageV2 {...DEFAULT_PROPS} tasks={tasks} />)

    const cardA = screen.getByTestId('pill-a')
    cardA.focus()

    fireEvent.keyDown(getStageBody(cardA), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(cardA)
  })
})

describe('PipelineStageV2 — resolveBlockingTitles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedBlockingTitles.length = 0
  })

  it('resolves known upstream ids to their task titles', () => {
    const blockedTask = makeTask({
      id: 'blocked-1',
      status: 'blocked',
      depends_on: [
        { id: 'upstream-a', type: 'hard' },
        { id: 'upstream-b', type: 'hard' }
      ]
    })

    const titleMap = new Map([
      ['upstream-a', 'Feature A'],
      ['upstream-b', 'Feature B']
    ])

    render(
      <PipelineStageV2
        {...DEFAULT_PROPS}
        name="blocked"
        label="Blocked"
        tasks={[blockedTask]}
        taskTitlesById={titleMap}
      />
    )

    expect(capturedBlockingTitles[0]).toBe('Feature A, Feature B')
  })

  it('falls back to the raw id when a title is not in the map', () => {
    const blockedTask = makeTask({
      id: 'blocked-2',
      status: 'blocked',
      depends_on: [{ id: 'unknown-dep', type: 'hard' }]
    })

    render(
      <PipelineStageV2
        {...DEFAULT_PROPS}
        name="blocked"
        label="Blocked"
        tasks={[blockedTask]}
        taskTitlesById={new Map()}
      />
    )

    expect(capturedBlockingTitles[0]).toBe('unknown-dep')
  })

  it('passes null blockingTitles for non-blocked stages', () => {
    const task = makeTask({ id: 'q-1', status: 'queued' })
    render(<PipelineStageV2 {...DEFAULT_PROPS} name="queued" tasks={[task]} />)
    expect(capturedBlockingTitles[0]).toBeNull()
  })

  it('passes null when the blocked task has no deps', () => {
    const blockedTask = makeTask({ id: 'blocked-3', status: 'blocked', depends_on: null })

    render(
      <PipelineStageV2
        {...DEFAULT_PROPS}
        name="blocked"
        label="Blocked"
        tasks={[blockedTask]}
        taskTitlesById={new Map()}
      />
    )

    expect(capturedBlockingTitles[0]).toBeNull()
  })
})
