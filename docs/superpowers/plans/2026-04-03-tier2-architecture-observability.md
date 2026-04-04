# Tier 2: Architecture & Observability

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the repository pattern to all query functions, add main process coverage enforcement, add agent activity preview in Pipeline, implement status transition validation, add review notification badge, and add focus management for drawers/overlays.

**Architecture:** Six tasks. Tasks 5 (repository) and 8 (state machine) are backend-only and tightly coupled — do 8 before 5. Tasks 6 (coverage), 7 (activity preview), 9 (badge), and 10 (focus) are independent.

**Tech Stack:** TypeScript, React, Zustand, vitest, better-sqlite3, CSS

**Spec:** `docs/superpowers/specs/2026-04-03-task-pipeline-csuite-audit.md` (Tier 2 section)

---

### Task 5: Extend `ISprintTaskRepository` to cover all query functions

Currently `sprint-task-repository.ts` covers only 7 operations for agent-manager. IPC handlers and Queue API import `sprint-queries` directly. Expand the interface so all consumers go through one abstraction.

**Files:**

- Modify: `src/main/data/sprint-task-repository.ts`
- Modify: `src/main/services/sprint-service.ts` (use repository instead of raw imports)
- Modify: `src/main/handlers/sprint-local.ts` (remove raw `_getTask`/`_createTask`/`_updateTask`/`_deleteTask` imports)
- Test: Existing integration tests should continue passing

- [ ] **Step 1: Inventory all functions in `sprint-queries.ts` not in the interface**

Read `src/main/data/sprint-queries.ts` and list every exported function. Current interface has: `getTask`, `updateTask`, `getQueuedTasks`, `getTasksWithDependencies`, `getOrphanedTasks`, `getActiveTaskCount`, `claimTask`.

Missing (need to add): `listTasks`, `createTask`, `deleteTask`, `releaseTask`, `getQueueStats`, `getDoneTodayCount`, `markTaskDoneByPrNumber`, `markTaskCancelledByPrNumber`, `listTasksWithOpenPrs`, `updateTaskMergeableState`, `getHealthCheckTasks`.

- [ ] **Step 2: Write test that the expanded interface is implemented**

```typescript
import { createSprintTaskRepository } from '../sprint-task-repository'

describe('SprintTaskRepository', () => {
  it('implements all required methods', () => {
    const repo = createSprintTaskRepository()
    const methods = [
      'getTask',
      'updateTask',
      'getQueuedTasks',
      'getTasksWithDependencies',
      'getOrphanedTasks',
      'getActiveTaskCount',
      'claimTask',
      // New methods:
      'listTasks',
      'createTask',
      'deleteTask',
      'releaseTask',
      'getQueueStats',
      'getDoneTodayCount',
      'markTaskDoneByPrNumber',
      'markTaskCancelledByPrNumber',
      'listTasksWithOpenPrs',
      'updateTaskMergeableState',
      'getHealthCheckTasks'
    ]
    for (const method of methods) {
      expect(typeof repo[method]).toBe('function')
    }
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run --config src/main/vitest.main.config.ts -t "SprintTaskRepository"`
Expected: FAIL — new methods don't exist on the interface

- [ ] **Step 4: Expand the interface and implementation**

In `src/main/data/sprint-task-repository.ts`, add all missing method signatures to `ISprintTaskRepository` and their delegations in `createSprintTaskRepository()`:

```typescript
export interface ISprintTaskRepository {
  // Existing
  getTask(id: string): SprintTask | null
  updateTask(id: string, patch: Record<string, unknown>): SprintTask | null
  getQueuedTasks(limit: number): SprintTask[]
  getTasksWithDependencies(): Array<{
    id: string
    depends_on: TaskDependency[] | null
    status: string
  }>
  getOrphanedTasks(claimedBy: string): SprintTask[]
  getActiveTaskCount(): number
  claimTask(id: string, claimedBy: string): SprintTask | null

  // New
  listTasks(status?: string): SprintTask[]
  createTask(input: CreateTaskInput): SprintTask | null
  deleteTask(id: string): void
  releaseTask(id: string, claimedBy: string): SprintTask | null
  getQueueStats(): QueueStats
  getDoneTodayCount(): number
  markTaskDoneByPrNumber(prNumber: number): string[]
  markTaskCancelledByPrNumber(prNumber: number): string[]
  listTasksWithOpenPrs(): SprintTask[]
  updateTaskMergeableState(prNumber: number, state: string): void
  getHealthCheckTasks(): SprintTask[]
}
```

Add the import for `CreateTaskInput` and `QueueStats` types. Delegate each new method to the corresponding `queries.*` function.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --config src/main/vitest.main.config.ts -t "SprintTaskRepository"`
Expected: PASS

- [ ] **Step 6: Update `sprint-service.ts` to accept repository**

Refactor `src/main/services/sprint-service.ts` to accept an `ISprintTaskRepository` instead of importing raw queries. Keep the notification wrapping behavior. This is a thin change — replace direct `_getTask(id)` calls with `repo.getTask(id)`.

The service still adds notification logic on top, so it's: `caller → sprint-service → repository → sprint-queries`.

- [ ] **Step 7: Remove dual imports from `sprint-local.ts`**

In `src/main/handlers/sprint-local.ts`, remove lines 24-29 (raw `_getTask`, `_createTask`, `_updateTask`, `_deleteTask`, `_getHealthCheckTasks` imports). All handler code should go through the sprint-service layer exclusively.

The `sprint:unblockTask` handler (line ~315) that currently calls `_updateTask` directly should call the service's `updateTask` instead.

- [ ] **Step 8: Run full test suites**

Run: `npm test && npm run test:main && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add src/main/data/sprint-task-repository.ts \
        src/main/services/sprint-service.ts \
        src/main/handlers/sprint-local.ts
git commit -m "refactor: extend ISprintTaskRepository to cover all query functions

Eliminates the dual-import pattern where sprint-local.ts imported
both raw queries and service-wrapped versions. All data access now
flows through the repository interface for consistent behavior."
```

---

### Task 6: Add main process coverage thresholds

The renderer has enforced coverage thresholds (72% stmts, 65% branches). The main process — where all critical orchestration lives — has none.

**Files:**

- Modify: `src/main/vitest.main.config.ts`
- Modify: `package.json` (add `test:main:coverage` script)

- [ ] **Step 1: Check current main process coverage**

Run: `npx vitest run --config src/main/vitest.main.config.ts --coverage`
Note the current coverage percentages for statements, branches, functions, lines.

- [ ] **Step 2: Add coverage thresholds to main vitest config**

In `src/main/vitest.main.config.ts`, add coverage configuration. Set thresholds at the current level (ratchet — never lower, only up):

```typescript
coverage: {
  provider: 'v8',
  include: ['src/main/**/*.ts'],
  exclude: ['src/main/**/*.test.ts', 'src/main/__tests__/**'],
  thresholds: {
    statements: <current>,
    branches: <current>,
    functions: <current>,
    lines: <current>
  }
}
```

- [ ] **Step 3: Add npm script**

In `package.json`, add:

```json
"test:main:coverage": "vitest run --config src/main/vitest.main.config.ts --coverage"
```

- [ ] **Step 4: Verify the threshold enforcement works**

Run: `npm run test:main:coverage`
Expected: PASS (thresholds set at current level)

- [ ] **Step 5: Commit**

```bash
git add src/main/vitest.main.config.ts package.json
git commit -m "chore: add coverage thresholds for main process tests

Main process contains all critical orchestration (agent manager,
completion handler, watchdog, dependency resolution) but had no
enforced coverage. Thresholds set at current level for ratcheting."
```

---

### Task 7: Add agent activity preview to TaskDetailDrawer

When a task is `active`, show the last 3-5 lines of agent output in the TaskDetailDrawer. The event infrastructure exists (`agent_events` table, SSE, IPC broadcast).

**Files:**

- Create: `src/renderer/src/components/sprint/AgentActivityPreview.tsx`
- Create: `src/renderer/src/components/sprint/__tests__/AgentActivityPreview.test.tsx`
- Modify: `src/renderer/src/components/sprint/TaskDetailDrawer.tsx`
- CSS: `src/renderer/src/assets/sprint-pipeline-neon.css`

- [ ] **Step 1: Write failing test for AgentActivityPreview**

```typescript
import { render, screen } from '@testing-library/react'
import { AgentActivityPreview } from '../AgentActivityPreview'

describe('AgentActivityPreview', () => {
  it('renders recent agent events', () => {
    const events = [
      { id: 1, type: 'assistant', content: 'Reading file src/main.ts' },
      { id: 2, type: 'assistant', content: 'Writing test for login' },
    ]
    render(<AgentActivityPreview events={events} />)
    expect(screen.getByText(/Reading file/)).toBeInTheDocument()
    expect(screen.getByText(/Writing test/)).toBeInTheDocument()
  })

  it('shows empty state when no events', () => {
    render(<AgentActivityPreview events={[]} />)
    expect(screen.getByText(/waiting for output/i)).toBeInTheDocument()
  })

  it('truncates long event text', () => {
    const longText = 'x'.repeat(200)
    render(<AgentActivityPreview events={[{ id: 1, type: 'assistant', content: longText }]} />)
    const el = screen.getByText(/x+/)
    expect(el.textContent!.length).toBeLessThan(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/sprint/__tests__/AgentActivityPreview.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement AgentActivityPreview component**

Create `src/renderer/src/components/sprint/AgentActivityPreview.tsx`:

```typescript
interface AgentEvent {
  id: number
  type: string
  content: string
}

interface AgentActivityPreviewProps {
  events: AgentEvent[]
  maxLines?: number
}

const MAX_LINE_LENGTH = 120

export function AgentActivityPreview({
  events,
  maxLines = 5
}: AgentActivityPreviewProps): React.JSX.Element {
  const recent = events.slice(-maxLines)

  if (recent.length === 0) {
    return (
      <div className="agent-preview agent-preview--empty">
        <span className="agent-preview__waiting">Waiting for output...</span>
      </div>
    )
  }

  return (
    <div className="agent-preview" aria-label="Agent activity">
      {recent.map((event) => (
        <div key={event.id} className="agent-preview__line">
          <span className="agent-preview__text">
            {event.content.length > MAX_LINE_LENGTH
              ? event.content.slice(0, MAX_LINE_LENGTH) + '...'
              : event.content}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/sprint/__tests__/AgentActivityPreview.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Integrate into TaskDetailDrawer**

In `src/renderer/src/components/sprint/TaskDetailDrawer.tsx`, for active tasks with an `agent_run_id`:

1. Import the component
2. Subscribe to agent events from the `agentEvents` store for the task's `agent_run_id`
3. Extract text content from recent events (filter to `type === 'assistant'` or `type === 'text'`)
4. Render `<AgentActivityPreview events={recentEvents} />` in the drawer body after the agent link section

- [ ] **Step 6: Add CSS classes**

Add `.agent-preview`, `.agent-preview__line`, `.agent-preview__text`, `.agent-preview__waiting` to `sprint-pipeline-neon.css`. Use monospace font, dim text, terminal aesthetic.

- [ ] **Step 7: Run full test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/sprint/AgentActivityPreview.tsx \
        src/renderer/src/components/sprint/__tests__/ \
        src/renderer/src/components/sprint/TaskDetailDrawer.tsx \
        src/renderer/src/assets/sprint-pipeline-neon.css
git commit -m "feat(pipeline): show live agent activity preview in task drawer

Active tasks now display the last 5 lines of agent output directly
in the TaskDetailDrawer. Transforms the Pipeline from a status board
into a control center without requiring navigation to Agents view."
```

---

### Task 8: Add status transition state machine

`updateTask()` in `sprint-queries.ts` accepts any status value passing the allowlist. Add a `VALID_TRANSITIONS` map and enforce it at the data layer.

**Files:**

- Create: `src/shared/task-transitions.ts`
- Create: `src/shared/__tests__/task-transitions.test.ts`
- Modify: `src/main/data/sprint-queries.ts` (enforce in `updateTask`)

- [ ] **Step 1: Write test for valid transitions**

Create `src/shared/__tests__/task-transitions.test.ts`:

```typescript
import { isValidTransition, VALID_TRANSITIONS } from '../task-transitions'

describe('task-transitions', () => {
  it('allows backlog → queued', () => {
    expect(isValidTransition('backlog', 'queued')).toBe(true)
  })

  it('allows queued → active', () => {
    expect(isValidTransition('queued', 'active')).toBe(true)
  })

  it('allows active → review', () => {
    expect(isValidTransition('active', 'review')).toBe(true)
  })

  it('allows active → failed', () => {
    expect(isValidTransition('active', 'failed')).toBe(true)
  })

  it('rejects done → active', () => {
    expect(isValidTransition('done', 'active')).toBe(false)
  })

  it('rejects backlog → done (skipping steps)', () => {
    expect(isValidTransition('backlog', 'done')).toBe(false)
  })

  it('allows any status → cancelled', () => {
    expect(isValidTransition('backlog', 'cancelled')).toBe(true)
    expect(isValidTransition('active', 'cancelled')).toBe(true)
    expect(isValidTransition('queued', 'cancelled')).toBe(true)
  })

  it('allows review → queued (revision request)', () => {
    expect(isValidTransition('review', 'queued')).toBe(true)
  })

  it('allows review → done (merge)', () => {
    expect(isValidTransition('review', 'done')).toBe(true)
  })

  it('allows failed → queued (retry)', () => {
    expect(isValidTransition('failed', 'queued')).toBe(true)
  })

  it('allows error → queued (retry)', () => {
    expect(isValidTransition('error', 'queued')).toBe(true)
  })

  it('allows blocked → queued (unblock)', () => {
    expect(isValidTransition('blocked', 'queued')).toBe(true)
  })

  it('allows queued → blocked (auto-block on dep check)', () => {
    expect(isValidTransition('queued', 'blocked')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/__tests__/task-transitions.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement the state machine**

Create `src/shared/task-transitions.ts`:

```typescript
/**
 * Valid task status transitions.
 * Key = current status, value = set of allowed next statuses.
 * 'cancelled' is always allowed from any status (universal escape hatch).
 */
export const VALID_TRANSITIONS: Record<string, Set<string>> = {
  backlog: new Set(['queued', 'blocked', 'cancelled']),
  queued: new Set(['active', 'blocked', 'cancelled']),
  blocked: new Set(['queued', 'cancelled']),
  active: new Set(['review', 'done', 'failed', 'error', 'cancelled']),
  review: new Set(['queued', 'done', 'cancelled']),
  done: new Set(['cancelled']),
  failed: new Set(['queued', 'cancelled']),
  error: new Set(['queued', 'cancelled']),
  cancelled: new Set([]) // terminal — no transitions out
}

export function isValidTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.has(to)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/__tests__/task-transitions.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Enforce in `updateTask()`**

In `src/main/data/sprint-queries.ts`, inside the `updateTask` function, after fetching the existing task and before applying the patch:

```typescript
import { isValidTransition } from '../../shared/task-transitions'

// Inside updateTask(), after line ~200 where existing task is fetched:
if (patch.status && typeof patch.status === 'string') {
  const currentStatus = existing.status as string
  if (!isValidTransition(currentStatus, patch.status)) {
    logger.warn(`Invalid status transition: ${currentStatus} → ${patch.status} for task ${id}`)
    return null
  }
}
```

Return `null` for invalid transitions — callers already handle null returns.

- [ ] **Step 6: Run full test suites**

Run: `npm test && npm run test:main && npm run typecheck`
Expected: ALL PASS (some tests may need updating if they relied on invalid transitions)

- [ ] **Step 7: Commit**

```bash
git add src/shared/task-transitions.ts \
        src/shared/__tests__/task-transitions.test.ts \
        src/main/data/sprint-queries.ts
git commit -m "feat: add task status transition state machine

Defines VALID_TRANSITIONS map in shared module and enforces it
in updateTask() at the data layer. Prevents invalid status changes
like done→active. Centralizes validation that was previously
scattered across handlers."
```

---

### Task 9: Add review notification badge to sidebar

When tasks enter `review` status, show a badge count on the Code Review nav item in the sidebar.

**Files:**

- Modify: `src/renderer/src/components/layout/NeonSidebar.tsx`
- Modify: `src/renderer/src/components/layout/SidebarItem.tsx` (add badge prop)
- Test: `src/renderer/src/components/layout/__tests__/NeonSidebar.test.tsx`
- CSS: `src/renderer/src/assets/neon.css` or relevant sidebar CSS

- [ ] **Step 1: Write failing test**

```typescript
it('shows badge count on Code Review when tasks are in review status', () => {
  // Set sprintTasks store with 2 tasks in review status
  useSprintTasks.setState({
    tasks: [
      { id: '1', status: 'review', title: 'A' } as SprintTask,
      { id: '2', status: 'review', title: 'B' } as SprintTask,
      { id: '3', status: 'active', title: 'C' } as SprintTask,
    ]
  })
  render(<NeonSidebar />)
  expect(screen.getByTestId('sidebar-badge-code-review')).toHaveTextContent('2')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/layout/__tests__/NeonSidebar.test.tsx`
Expected: FAIL — no badge element exists

- [ ] **Step 3: Add badge to SidebarItem**

In `SidebarItem.tsx`, add an optional `badge?: number` prop. When > 0, render a small counter:

```typescript
{badge != null && badge > 0 && (
  <span className="sidebar-item__badge" data-testid={`sidebar-badge-${viewKey}`}>
    {badge > 9 ? '9+' : badge}
  </span>
)}
```

- [ ] **Step 4: Compute review count and pass to Code Review sidebar item**

In `NeonSidebar.tsx`, subscribe to `sprintTasks` store for review count:

```typescript
const reviewCount = useSprintTasks((s) => s.tasks.filter((t) => t.status === 'review').length)
```

Pass `badge={view === 'code-review' ? reviewCount : undefined}` to the corresponding `SidebarItem`.

- [ ] **Step 5: Add badge CSS**

```css
.sidebar-item__badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--neon-orange);
  color: var(--neon-bg);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
```

- [ ] **Step 6: Run full test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/layout/NeonSidebar.tsx \
        src/renderer/src/components/layout/SidebarItem.tsx \
        src/renderer/src/components/layout/__tests__/ \
        src/renderer/src/assets/
git commit -m "feat(sidebar): show review badge count on Code Review nav item

Tasks in 'review' status now show an orange badge count on the
Code Review sidebar icon. Prevents tasks from sitting unnoticed
in review when the user is working in other views."
```

---

### Task 10: Add focus management for drawer and overlays

When TaskDetailDrawer opens, move focus to the drawer. On close, return focus to the triggering TaskPill. Add focus traps to modal overlays.

**Files:**

- Modify: `src/renderer/src/components/sprint/TaskDetailDrawer.tsx`
- Modify: `src/renderer/src/components/sprint/SprintPipeline.tsx` (track triggering element)
- Test: `src/renderer/src/components/sprint/__tests__/TaskDetailDrawer.test.tsx`

- [ ] **Step 1: Write failing test for focus management**

```typescript
it('moves focus to drawer heading when opened', () => {
  const task = makeTask({ status: 'active' })
  render(<TaskDetailDrawer {...defaultProps} task={task} />)
  expect(screen.getByRole('heading', { name: task.title })).toHaveFocus()
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — focus is not moved to the heading

- [ ] **Step 3: Add focus-on-mount to TaskDetailDrawer**

In `TaskDetailDrawer.tsx`, add a ref to the title heading and focus it on mount:

```typescript
const titleRef = useRef<HTMLHeadingElement>(null)

useEffect(() => {
  titleRef.current?.focus()
}, [task.id]) // Re-focus when task changes

// On the heading:
<h2 className="task-drawer__title" ref={titleRef} tabIndex={-1}>{task.title}</h2>
```

- [ ] **Step 4: Track and restore focus in SprintPipeline**

In `SprintPipeline.tsx`, store a ref to the triggering TaskPill element. When the drawer closes, return focus to it:

```typescript
const triggerRef = useRef<HTMLElement | null>(null)

const handleTaskClick = useCallback(
  (id: string) => {
    triggerRef.current = document.activeElement as HTMLElement
    setSelectedTaskId(id)
  },
  [setSelectedTaskId]
)

const handleCloseDrawer = useCallback(() => {
  setDrawerOpen(false)
  setSelectedTaskId(null)
  // Return focus to triggering element
  requestAnimationFrame(() => {
    triggerRef.current?.focus()
    triggerRef.current = null
  })
}, [setDrawerOpen, setSelectedTaskId])
```

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
git commit -m "fix(a11y): add focus management for TaskDetailDrawer

Focus moves to the drawer heading when opened and returns to
the triggering TaskPill when closed. Follows WAI-ARIA disclosure
pattern for keyboard/screen reader users."
```
