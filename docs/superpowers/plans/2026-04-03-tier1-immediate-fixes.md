# Tier 1: Immediate Fixes — Security + Workflow Breaks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the command injection bug, add Pipeline→Code Review navigation, build the dependency picker in Workbench, and fix nested interactive element a11y violations.

**Architecture:** Four independent changes. Task 1 is main-process only. Tasks 2-4 are renderer-only. All can be parallelized.

**Tech Stack:** TypeScript, React, Zustand, vitest, CSS

**Spec:** `docs/superpowers/specs/2026-04-03-task-pipeline-csuite-audit.md` (Tier 1 section)

---

### Task 1: Fix `sanitizeForGit` command injection

The current regex in `completion.ts:27` replaces `$(` with `$(` — identical strings (no-op). Task titles come from user input via Queue API and UI, so this is a real injection vector when used in `git commit -m`.

**Files:**

- Modify: `src/main/agent-manager/completion.ts:24-30`
- Modify: `src/main/__tests__/integration/agent-completion-pipeline.test.ts` (or create unit test)

- [ ] **Step 1: Write failing test for command substitution**

```typescript
// In a test file for completion.ts
import { sanitizeForGit } from '../completion'

describe('sanitizeForGit', () => {
  it('strips backticks', () => {
    expect(sanitizeForGit('hello `world`')).toBe("hello 'world'")
  })

  it('neutralizes command substitution $()', () => {
    const input = 'task $(rm -rf /)'
    const result = sanitizeForGit(input)
    expect(result).not.toContain('$(')
  })

  it('neutralizes nested command substitution', () => {
    const input = 'fix $(echo $(whoami))'
    const result = sanitizeForGit(input)
    expect(result).not.toContain('$(')
  })

  it('strips markdown links keeping text', () => {
    expect(sanitizeForGit('[click](http://evil.com)')).toBe('click')
  })

  it('trims whitespace', () => {
    expect(sanitizeForGit('  hello  ')).toBe('hello')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config src/main/vitest.main.config.ts -t "sanitizeForGit"`
Expected: The `$(` test cases FAIL because current code is a no-op.

- [ ] **Step 3: Fix the regex to actually strip `$(`**

In `src/main/agent-manager/completion.ts:24-30`, replace:

```typescript
export function sanitizeForGit(title: string): string {
  return title
    .replace(/`/g, "'")
    .replace(/\$\(/g, '(') // Strip the $ from $( — leaves just (
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}
```

The fix: replace `$(` with `(` (removing the `$`). This breaks command substitution while preserving readability of titles that legitimately contain parentheses.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config src/main/vitest.main.config.ts -t "sanitizeForGit"`
Expected: ALL PASS

- [ ] **Step 5: Run full test suites**

Run: `npm test && npm run test:main && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/agent-manager/completion.ts src/main/__tests__/
git commit -m "fix(security): neutralize command substitution in sanitizeForGit

The regex was replacing \$( with \$( — identical strings, a no-op.
Now strips the \$ prefix, breaking shell command substitution in
git commit messages constructed from user-provided task titles."
```

---

### Task 2: Add "Review Changes" button to TaskDetailDrawer

When a task is in `review` status, add a prominent button that navigates to Code Review with the task pre-selected. This eliminates the P0 Pipeline→Code Review disconnect.

**Files:**

- Modify: `src/renderer/src/components/sprint/TaskDetailDrawer.tsx`
- Modify: `src/renderer/src/components/sprint/SprintPipeline.tsx` (pass new callback)
- Modify: `src/renderer/src/stores/codeReview.ts` (verify `selectTask` exists)
- Test: `src/renderer/src/components/sprint/__tests__/TaskDetailDrawer.test.tsx`

- [ ] **Step 1: Write failing test for "Review Changes" button**

In the TaskDetailDrawer test file, add:

```typescript
it('shows "Review Changes" button for tasks in review status', () => {
  const task = makeTask({ status: 'review' })
  render(<TaskDetailDrawer {...defaultProps} task={task} onReviewChanges={vi.fn()} />)
  expect(screen.getByRole('button', { name: /review changes/i })).toBeInTheDocument()
})

it('does not show "Review Changes" button for non-review tasks', () => {
  const task = makeTask({ status: 'active' })
  render(<TaskDetailDrawer {...defaultProps} task={task} onReviewChanges={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /review changes/i })).not.toBeInTheDocument()
})

it('calls onReviewChanges when button is clicked', async () => {
  const onReviewChanges = vi.fn()
  const task = makeTask({ status: 'review' })
  render(<TaskDetailDrawer {...defaultProps} task={task} onReviewChanges={onReviewChanges} />)
  await userEvent.click(screen.getByRole('button', { name: /review changes/i }))
  expect(onReviewChanges).toHaveBeenCalledWith(task)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/sprint/__tests__/TaskDetailDrawer.test.tsx`
Expected: FAIL — `onReviewChanges` prop doesn't exist

- [ ] **Step 3: Add `onReviewChanges` prop and button to TaskDetailDrawer**

In `src/renderer/src/components/sprint/TaskDetailDrawer.tsx`:

1. Add to interface:

```typescript
onReviewChanges?: (task: SprintTask) => void
```

2. Add to destructured props

3. Add button in the body, after the agent link section (after line 232), before the PR section:

```typescript
{task.status === 'review' && onReviewChanges && (
  <button
    className="task-drawer__btn task-drawer__btn--primary"
    onClick={() => onReviewChanges(task)}
  >
    Review Changes →
  </button>
)}
```

- [ ] **Step 4: Wire the callback in SprintPipeline.tsx**

In `src/renderer/src/components/sprint/SprintPipeline.tsx`:

1. Import the code review store at the top of the file:

```typescript
import { useCodeReview } from '../../stores/codeReview'
```

2. Add a handler that pre-selects the task in the code review store, then navigates:

```typescript
const handleReviewChanges = useCallback(
  (task: SprintTask) => {
    // Pre-select the task in code review store BEFORE navigating
    // so when the view mounts, it already has the selection
    useCodeReview.getState().selectTask(task.id)
    // Navigate to code-review view
    setView('code-review')
  },
  [setView]
)
```

This avoids `setTimeout` races by setting store state before the view mounts. Zustand stores are global singletons, so `getState().selectTask()` works regardless of component mounting.

3. Pass `onReviewChanges={handleReviewChanges}` to `TaskDetailDrawer`.

4. Verify the `useCodeReview` store's `selectTask` method exists by reading `src/renderer/src/stores/codeReview.ts`. It should set `selectedTaskId` which `CodeReviewView` reads on mount to auto-show the task detail.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/renderer/src/components/sprint/__tests__/TaskDetailDrawer.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: Run full test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/sprint/TaskDetailDrawer.tsx \
        src/renderer/src/components/sprint/SprintPipeline.tsx \
        src/renderer/src/components/sprint/__tests__/
git commit -m "feat(pipeline): add Review Changes button linking to Code Review

Tasks in 'review' status now show a prominent button in the detail
drawer that navigates directly to Code Review with the task pre-selected.
Eliminates the manual view-switching friction for every review."
```

---

### Task 3: Build dependency picker in Workbench form

The backend supports hard/soft dependencies with cycle detection, but the creation form has no UI for it. Add a dependency picker to the Advanced section of WorkbenchForm.

**Files:**

- Create: `src/renderer/src/components/task-workbench/DependencyPicker.tsx`
- Create: `src/renderer/src/components/task-workbench/__tests__/DependencyPicker.test.tsx`
- Modify: `src/renderer/src/components/task-workbench/WorkbenchForm.tsx:339-375`
- CSS: `src/renderer/src/assets/task-workbench-neon.css`

- [ ] **Step 1: Write failing test for DependencyPicker component**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DependencyPicker } from '../DependencyPicker'
import type { TaskDependency, SprintTask } from '../../../../../shared/types'

const mockTasks: SprintTask[] = [
  { id: '1', title: 'Setup DB', status: 'done', repo: 'bde' } as SprintTask,
  { id: '2', title: 'Build API', status: 'queued', repo: 'bde' } as SprintTask,
  { id: '3', title: 'Write Tests', status: 'backlog', repo: 'bde' } as SprintTask,
]

describe('DependencyPicker', () => {
  it('renders selected dependencies', () => {
    const deps: TaskDependency[] = [{ id: '1', type: 'hard' }]
    render(
      <DependencyPicker
        dependencies={deps}
        availableTasks={mockTasks}
        onChange={vi.fn()}
        currentTaskId={undefined}
      />
    )
    expect(screen.getByText(/Setup DB/)).toBeInTheDocument()
    expect(screen.getByText(/hard/i)).toBeInTheDocument()
  })

  it('filters out current task from available list', async () => {
    render(
      <DependencyPicker
        dependencies={[]}
        availableTasks={mockTasks}
        onChange={vi.fn()}
        currentTaskId="1"
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /add dependency/i }))
    expect(screen.queryByText('Setup DB')).not.toBeInTheDocument()
    expect(screen.getByText('Build API')).toBeInTheDocument()
  })

  it('calls onChange when dependency added', async () => {
    const onChange = vi.fn()
    render(
      <DependencyPicker
        dependencies={[]}
        availableTasks={mockTasks}
        onChange={onChange}
        currentTaskId={undefined}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /add dependency/i }))
    await userEvent.click(screen.getByText('Setup DB'))
    expect(onChange).toHaveBeenCalledWith([{ id: '1', type: 'hard' }])
  })

  it('calls onChange when dependency removed', async () => {
    const onChange = vi.fn()
    const deps: TaskDependency[] = [{ id: '1', type: 'hard' }]
    render(
      <DependencyPicker
        dependencies={deps}
        availableTasks={mockTasks}
        onChange={onChange}
        currentTaskId={undefined}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(onChange).toHaveBeenCalledWith([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/task-workbench/__tests__/DependencyPicker.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement DependencyPicker component**

Create `src/renderer/src/components/task-workbench/DependencyPicker.tsx`:

```typescript
import { useState, useMemo } from 'react'
import type { TaskDependency, SprintTask } from '../../../../shared/types'

interface DependencyPickerProps {
  dependencies: TaskDependency[]
  availableTasks: SprintTask[]
  onChange: (deps: TaskDependency[]) => void
  currentTaskId: string | undefined
}

export function DependencyPicker({
  dependencies,
  availableTasks,
  onChange,
  currentTaskId
}: DependencyPickerProps): React.JSX.Element {
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')

  const depIds = useMemo(() => new Set(dependencies.map((d) => d.id)), [dependencies])

  const filteredTasks = useMemo(() => {
    return availableTasks.filter((t) => {
      if (t.id === currentTaskId) return false
      if (depIds.has(t.id)) return false
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [availableTasks, currentTaskId, depIds, search])

  const depTasks = useMemo(
    () =>
      dependencies
        .map((d) => {
          const task = availableTasks.find((t) => t.id === d.id)
          return task ? { ...d, title: task.title, status: task.status } : null
        })
        .filter(Boolean),
    [dependencies, availableTasks]
  )

  const handleAdd = (taskId: string): void => {
    onChange([...dependencies, { id: taskId, type: 'hard' }])
    setShowPicker(false)
    setSearch('')
  }

  const handleRemove = (taskId: string): void => {
    onChange(dependencies.filter((d) => d.id !== taskId))
  }

  const handleToggleType = (taskId: string): void => {
    onChange(
      dependencies.map((d) =>
        d.id === taskId ? { ...d, type: d.type === 'hard' ? 'soft' : 'hard' } : d
      )
    )
  }

  return (
    <div className="wb-deps">
      <label className="wb-field__label">Dependencies</label>

      {depTasks.length > 0 && (
        <div className="wb-deps__list">
          {depTasks.map((dep) => (
            <div key={dep!.id} className="wb-deps__item">
              <span className="wb-deps__title">{dep!.title}</span>
              <button
                className="wb-deps__type"
                onClick={() => handleToggleType(dep!.id)}
                title="Toggle hard/soft dependency"
              >
                {dep!.type}
              </button>
              <button
                className="wb-deps__remove"
                onClick={() => handleRemove(dep!.id)}
                aria-label={`Remove dependency on ${dep!.title}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {showPicker ? (
        <div className="wb-deps__picker">
          <input
            className="wb-deps__search"
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="wb-deps__results">
            {filteredTasks.slice(0, 10).map((task) => (
              <button
                key={task.id}
                className="wb-deps__result"
                onClick={() => handleAdd(task.id)}
              >
                <span>{task.title}</span>
                <span className="wb-deps__result-status">{task.status}</span>
              </button>
            ))}
            {filteredTasks.length === 0 && (
              <div className="wb-deps__empty">No matching tasks</div>
            )}
          </div>
          <button
            className="wb-deps__cancel"
            onClick={() => {
              setShowPicker(false)
              setSearch('')
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="wb-deps__add"
          onClick={() => setShowPicker(true)}
          aria-label="Add dependency"
        >
          + Add dependency
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/task-workbench/__tests__/DependencyPicker.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Integrate DependencyPicker into WorkbenchForm**

In `src/renderer/src/components/task-workbench/WorkbenchForm.tsx`:

1. Import the component and the sprint tasks store:

```typescript
import { DependencyPicker } from './DependencyPicker'
```

2. Add tasks from store (after other store selectors around line 38):

```typescript
const allTasks = useSprintTasks((s) => s.tasks)
```

3. In the Advanced section (around line 339-375), add the DependencyPicker before the Priority dropdown:

```typescript
<DependencyPicker
  dependencies={dependsOn ?? []}
  availableTasks={allTasks}
  onChange={(deps) => setField('dependsOn', deps)}
  currentTaskId={taskId ?? undefined}
/>
```

- [ ] **Step 6: Add CSS classes to `task-workbench-neon.css`**

Add BEM classes for `.wb-deps`, `.wb-deps__list`, `.wb-deps__item`, `.wb-deps__picker`, `.wb-deps__search`, `.wb-deps__result`, etc. Follow existing `.wb-*` naming convention.

- [ ] **Step 7: Run full test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/task-workbench/DependencyPicker.tsx \
        src/renderer/src/components/task-workbench/__tests__/ \
        src/renderer/src/components/task-workbench/WorkbenchForm.tsx \
        src/renderer/src/assets/task-workbench-neon.css
git commit -m "feat(workbench): add dependency picker to task creation form

The backend supports hard/soft dependencies with cycle detection,
but the creation UI had no way to add them. Now the Advanced section
includes a searchable dependency picker with hard/soft toggle."
```

---

### Task 4: Fix nested interactive elements in PipelineBacklog

`PipelineBacklog.tsx:31-59` wraps a `<button>` inside a `role="button"` `<div>`. This is an ARIA violation — nested interactive elements. Same issue at lines 68-99 for failed cards.

**Files:**

- Modify: `src/renderer/src/components/sprint/PipelineBacklog.tsx`
- Test: `src/renderer/src/components/sprint/__tests__/PipelineBacklog.test.tsx`
- CSS: `src/renderer/src/assets/sprint-pipeline-neon.css` (minor selector updates)

- [ ] **Step 1: Write test for accessible card structure**

```typescript
it('backlog card does not nest interactive elements', () => {
  render(<PipelineBacklog backlog={[mockTask]} failed={[]} onTaskClick={vi.fn()} onAddToQueue={vi.fn()} onRerun={vi.fn()} />)
  const card = screen.getByTestId('backlog-card-' + mockTask.id)
  // Card should not have role="button" — it wraps a button
  expect(card).not.toHaveAttribute('role', 'button')
  // The title area and action button should be separate interactive elements
  const buttons = within(card).getAllByRole('button')
  expect(buttons.length).toBeGreaterThanOrEqual(2) // select + queue action
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/sprint/__tests__/PipelineBacklog.test.tsx`
Expected: FAIL — card currently has `role="button"`

- [ ] **Step 3: Restructure backlog and failed cards**

In `src/renderer/src/components/sprint/PipelineBacklog.tsx`:

Replace the backlog card (lines 31-59) — remove `role="button"` from the outer `<div>`, make the title area a `<button>` for selection, keep the action button separate:

```typescript
{backlog.map((task) => (
  <div key={task.id} className="backlog-card" data-testid={`backlog-card-${task.id}`}>
    <button
      className="backlog-card__select"
      onClick={() => onTaskClick(task.id)}
      aria-label={`Select task: ${task.title}`}
    >
      <div className="backlog-card__title">{task.title}</div>
      <div className="backlog-card__meta">
        <span>{task.repo}</span>
        {task.priority <= 2 && <span>P{task.priority}</span>}
      </div>
    </button>
    <button
      className="backlog-card__action"
      onClick={() => onAddToQueue(task)}
    >
      → Add to queue
    </button>
  </div>
))}
```

Apply the same pattern to failed cards (lines 68-99): remove `role="button"` from outer `<div>`, make title area a `<button>`, keep rerun button separate.

- [ ] **Step 4: Update CSS selectors if needed**

In `sprint-pipeline-neon.css`, if `.backlog-card` or `.failed-card` had `cursor: pointer` on the outer div, move it to `.backlog-card__select` and `.failed-card__select`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/renderer/src/components/sprint/__tests__/PipelineBacklog.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: Run full test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/sprint/PipelineBacklog.tsx \
        src/renderer/src/components/sprint/__tests__/ \
        src/renderer/src/assets/sprint-pipeline-neon.css
git commit -m "fix(a11y): remove nested interactive elements in PipelineBacklog

Backlog and failed cards had a <button> inside a role='button' div,
which is an ARIA violation. Restructured to use separate button
elements for selection and action, with no interactive nesting."
```
