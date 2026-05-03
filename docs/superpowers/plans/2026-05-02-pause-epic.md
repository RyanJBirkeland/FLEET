# Pause Epic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `is_paused` flag to epics so the drain loop skips their queued tasks until resumed, giving users a way to hold an epic mid-execution without cancelling tasks.

**Architecture:** SQLite migration adds `is_paused INTEGER NOT NULL DEFAULT 0` to `task_groups`. The `getQueuedTasks` query gains a LEFT JOIN that excludes tasks belonging to paused epics. The existing `groups:update` IPC channel carries `is_paused` — no new channel needed. A `togglePause` store action wires to a new Pause/Resume item in the `EpicHeader` overflow menu.

**Tech Stack:** SQLite (better-sqlite3), TypeScript, React, Vitest, Electron IPC.

---

## File Map

| File | Change |
|---|---|
| `src/main/migrations/v056-add-is-paused-to-task-groups.ts` | New — migration |
| `src/main/migrations/__tests__/v056.test.ts` | New — migration test |
| `src/shared/types/task-types.ts` | Modify — add `is_paused: boolean` to `TaskGroup` |
| `src/main/data/task-group-queries.ts` | Modify — `sanitizeGroup`, `UpdateGroupInput`, `updateGroup` allowlist |
| `src/main/data/sprint-queue-ops.ts` | Modify — `getQueuedTasks` LEFT JOIN filter |
| `src/shared/ipc-channels/sprint-channels.ts` | Modify — `groups:update` patch type |
| `src/renderer/src/stores/taskGroups.ts` | Modify — add `togglePause` action + update type |
| `src/renderer/src/components/planner/EpicHeader.tsx` | Modify — add Pause/Resume menu item |
| `src/renderer/src/components/planner/EpicDetail.tsx` | Modify — thread `onTogglePause` prop |
| `src/renderer/src/views/PlannerView.tsx` | Modify — wire `handleTogglePause` callback |
| `src/renderer/src/components/planner/__tests__/EpicHeader.test.tsx` | Modify — add `is_paused` to fixtures, new tests |

---

### Task 1: Migration + type update

**Files:**
- Create: `src/main/migrations/v056-add-is-paused-to-task-groups.ts`
- Create: `src/main/migrations/__tests__/v056.test.ts`
- Modify: `src/shared/types/task-types.ts`

- [ ] **Step 1: Create the migration**

Create `src/main/migrations/v056-add-is-paused-to-task-groups.ts`:

```typescript
import type Database from 'better-sqlite3'

export const version = 56
export const description = 'Add is_paused column to task_groups for drain-loop gating'

export const up = (db: Database.Database): void => {
  db.exec('ALTER TABLE task_groups ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0')
}
```

- [ ] **Step 2: Write migration tests**

Create `src/main/migrations/__tests__/v056.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { up, version } from '../v056-add-is-paused-to-task-groups'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE task_groups (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'G',
      accent_color TEXT DEFAULT '#00ffcc',
      goal TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      depends_on TEXT DEFAULT NULL
    )
  `)
  return db
}

describe('migration v056', () => {
  it('has version 56', () => {
    expect(version).toBe(56)
  })

  it('adds is_paused column with default 0', () => {
    const db = makeDb()
    db.exec("INSERT INTO task_groups (name) VALUES ('My Epic')")

    up(db)

    const cols = (db.pragma('table_info(task_groups)') as Array<{ name: string }>).map(c => c.name)
    expect(cols).toContain('is_paused')

    const row = db.prepare('SELECT is_paused FROM task_groups LIMIT 1').get() as { is_paused: number }
    expect(row.is_paused).toBe(0)
    db.close()
  })

  it('new rows default to is_paused = 0', () => {
    const db = makeDb()
    up(db)
    db.exec("INSERT INTO task_groups (name) VALUES ('New Epic')")
    const row = db.prepare('SELECT is_paused FROM task_groups LIMIT 1').get() as { is_paused: number }
    expect(row.is_paused).toBe(0)
    db.close()
  })

  it('is idempotent — running twice does not throw', () => {
    const db = makeDb()
    expect(() => { up(db); up(db) }).not.toThrow()
    db.close()
  })
})
```

- [ ] **Step 3: Run migration tests**

```bash
npm run test:main -- --run src/main/migrations/__tests__/v056.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 4: Add `is_paused` to `TaskGroup` type**

In `src/shared/types/task-types.ts`, add to the `TaskGroup` interface after the `depends_on` field:

```typescript
  /** When true, drain loop will not claim any of this epic's queued tasks. */
  is_paused: boolean
```

Run typecheck — expect errors in sanitizeGroup and the store (will be fixed in subsequent tasks):

```bash
npm run typecheck 2>&1 | grep "is_paused" | head -10
```

Expected: TypeScript errors about missing `is_paused` in several places (this is expected — fixed next).

- [ ] **Step 5: Commit**

```bash
git add src/main/migrations/v056-add-is-paused-to-task-groups.ts \
        src/main/migrations/__tests__/v056.test.ts \
        src/shared/types/task-types.ts
git commit -m "feat(epics): add is_paused field — migration v056 + TaskGroup type"
```

---

### Task 2: Data layer — sanitizer, updateGroup, drain loop filter

**Files:**
- Modify: `src/main/data/task-group-queries.ts`
- Modify: `src/main/data/sprint-queue-ops.ts`

- [ ] **Step 1: Write failing data layer tests**

In `src/main/data/__tests__/task-group-queries.test.ts`, find the existing test file and add these tests:

```typescript
  describe('is_paused round-trip', () => {
    it('sanitizeGroup returns is_paused: false when column is 0', () => {
      // Directly test via createGroup + getGroup
      const group = createGroup({ name: 'Test Epic' })
      expect(group).not.toBeNull()
      expect(group!.is_paused).toBe(false)
    })

    it('updateGroup persists is_paused: true and returns it', () => {
      const group = createGroup({ name: 'Pauseable Epic' })
      expect(group).not.toBeNull()
      const updated = updateGroup(group!.id, { is_paused: true })
      expect(updated).not.toBeNull()
      expect(updated!.is_paused).toBe(true)
    })

    it('updateGroup can resume a paused epic', () => {
      const group = createGroup({ name: 'Resume Epic' })
      updateGroup(group!.id, { is_paused: true })
      const resumed = updateGroup(group!.id, { is_paused: false })
      expect(resumed!.is_paused).toBe(false)
    })
  })
```

For the `getQueuedTasks` filter test, add to `src/main/data/__tests__/sprint-queue-ops.test.ts` (or the main sprint-queue test file — check which file has `getQueuedTasks` tests):

```typescript
  describe('is_paused epic gating', () => {
    it('excludes queued tasks belonging to a paused epic', () => {
      // Create an epic and mark it paused
      const group = createGroup({ name: 'Paused Epic' })
      updateGroup(group!.id, { is_paused: true })

      // Create a queued task belonging to that epic
      const task = createTask({
        title: 'Task in paused epic',
        repo: 'fleet',
        spec: '',
        spec_type: 'feature',
        priority: 1,
        group_id: group!.id
      })
      updateTask(task.id, { status: 'queued' })

      const queued = getQueuedTasks(10)
      expect(queued.find(t => t.id === task.id)).toBeUndefined()
    })

    it('includes queued tasks that have no group even when other epics are paused', () => {
      const group = createGroup({ name: 'Another Paused Epic' })
      updateGroup(group!.id, { is_paused: true })

      const ungroupedTask = createTask({
        title: 'Ungrouped task',
        repo: 'fleet',
        spec: '',
        spec_type: 'feature',
        priority: 1
      })
      updateTask(ungroupedTask.id, { status: 'queued' })

      const queued = getQueuedTasks(10)
      expect(queued.find(t => t.id === ungroupedTask.id)).toBeDefined()
    })
  })
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npm run test:main -- --run src/main/data/__tests__/
```

Expected: new tests fail.

- [ ] **Step 3: Update `task-group-queries.ts`**

In `src/main/data/task-group-queries.ts`:

**a) Add `is_paused` to `UpdateGroupInput`** (after `depends_on`):
```typescript
  /** When true, drain loop skips this epic's queued tasks. */
  is_paused?: boolean | undefined
```

**b) In `sanitizeGroup`**, add `is_paused` to the returned object (after `depends_on`):
```typescript
    is_paused: row.is_paused === 1,
```

**c) In `updateGroup`**, add `'is_paused'` to the `allowed` Set:
```typescript
      const allowed = new Set(['name', 'icon', 'accent_color', 'goal', 'status', 'depends_on', 'is_paused'])
```

**d) In `updateGroup`'s `values` mapping**, add serialization for `is_paused` before the `return value` fallback:
```typescript
        // Serialize depends_on to JSON if present
        if (f === 'depends_on') {
          return value && Array.isArray(value) && value.length > 0 ? JSON.stringify(value) : null
        }
        // Serialize boolean to SQLite integer
        if (f === 'is_paused') {
          return value ? 1 : 0
        }
        return value
```

- [ ] **Step 4: Update `getQueuedTasks` in `sprint-queue-ops.ts`**

Find `getQueuedTasks` at line 173. Replace the query string with:

```typescript
          `SELECT ${SPRINT_TASK_COLUMNS}
           FROM sprint_tasks
           LEFT JOIN task_groups tg ON sprint_tasks.group_id = tg.id
           WHERE sprint_tasks.status = 'queued'
             AND sprint_tasks.claimed_by IS NULL
             AND (sprint_tasks.next_eligible_at IS NULL OR sprint_tasks.next_eligible_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now'))
             AND (tg.id IS NULL OR tg.is_paused = 0)
           ORDER BY sprint_tasks.priority ASC, sprint_tasks.created_at ASC
           LIMIT ?`
```

- [ ] **Step 5: Run data layer tests**

```bash
npm run test:main -- --run src/main/data/__tests__/
npm run typecheck
```

Expected: all tests pass, zero type errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/data/task-group-queries.ts \
        src/main/data/sprint-queue-ops.ts
git commit -m "feat(epics): data layer — is_paused sanitizer, updateGroup, drain loop filter"
```

---

### Task 3: IPC channel type + store `togglePause`

**Files:**
- Modify: `src/shared/ipc-channels/sprint-channels.ts`
- Modify: `src/renderer/src/stores/taskGroups.ts`

- [ ] **Step 1: Add `is_paused` to `groups:update` IPC channel type**

In `src/shared/ipc-channels/sprint-channels.ts`, find `'groups:update'` (around line 320). Add `is_paused` to the `patch` args type:

```typescript
  'groups:update': {
    args: [
      id: string,
      patch: {
        name?: string | undefined
        icon?: string | undefined
        accent_color?: string | undefined
        goal?: string | undefined
        status?: 'draft' | 'ready' | 'in-pipeline' | 'completed' | undefined
        is_paused?: boolean | undefined
      }
    ]
    result: TaskGroup
  }
```

This automatically updates `window.api.groups.update`'s type (preload uses `typedInvoke`) and the renderer service `updateGroup` (which uses `Parameters<typeof window.api.groups.update>[1]` for its patch type). No other file changes needed.

- [ ] **Step 2: Add `togglePause` to `TaskGroupsState` interface in `taskGroups.ts`**

In `src/renderer/src/stores/taskGroups.ts`, in the `TaskGroupsState` interface, add after `updateGroup`:

```typescript
  togglePause: (id: string) => Promise<void>
```

Also update the `updateGroup` field in the interface to include `is_paused`:

```typescript
  updateGroup: (
    id: string,
    patch: {
      name?: string | undefined
      icon?: string | undefined
      accent_color?: string | undefined
      goal?: string | undefined
      status?: 'draft' | 'ready' | 'in-pipeline' | 'completed' | undefined
      is_paused?: boolean | undefined
    }
  ) => Promise<void>
```

- [ ] **Step 3: Implement `togglePause` action in the store**

In `src/renderer/src/stores/taskGroups.ts`, add the `togglePause` implementation after `updateGroup` (around line 145):

```typescript
  togglePause: async (id): Promise<void> => {
    const group = get().groups.find(g => g.id === id)
    if (!group) return
    const newPaused = !group.is_paused
    // Optimistic update
    set(s => ({ groups: s.groups.map(g => g.id === id ? { ...g, is_paused: newPaused } : g) }))
    try {
      const updated = await updateGroup(id, { is_paused: newPaused })
      set(s => ({ groups: s.groups.map(g => g.id === id ? updated : g) }))
      toast.success(newPaused ? 'Epic paused — drain loop will skip its queued tasks' : 'Epic resumed')
    } catch (e) {
      toast.error('Failed to toggle pause — ' + (e instanceof Error ? e.message : String(e)))
      await get().loadGroups()
    }
  },
```

- [ ] **Step 4: Run typecheck + full suite**

```bash
npm run typecheck && npm test -- --run
```

Expected: zero errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc-channels/sprint-channels.ts \
        src/renderer/src/stores/taskGroups.ts
git commit -m "feat(epics): IPC type + store togglePause action"
```

---

### Task 4: UI — EpicHeader menu item, EpicDetail, PlannerView

**Files:**
- Modify: `src/renderer/src/components/planner/EpicHeader.tsx`
- Modify: `src/renderer/src/components/planner/EpicDetail.tsx`
- Modify: `src/renderer/src/views/PlannerView.tsx`
- Modify: `src/renderer/src/components/planner/__tests__/EpicHeader.test.tsx`

- [ ] **Step 1: Write failing EpicHeader tests**

In `src/renderer/src/components/planner/__tests__/EpicHeader.test.tsx`:

**a) Add `is_paused: false` to `mockEpic`** (currently the object doesn't have it, causing TypeScript errors now that the type requires it):
```typescript
const mockEpic = {
  id: 'epic-1',
  name: 'Test Epic',
  goal: 'Test goal',
  status: 'draft' as const,
  icon: '📋',
  accent_color: '#4a9eff',
  task_ids: [],
  depends_on: [],
  is_paused: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}
```

**b) Add `onTogglePause={vi.fn()}` to ALL existing `<EpicHeader>` renders in the file** (it becomes a required prop).

**c) Add new tests at the bottom of the `describe` block:**

```typescript
  describe('pause/resume menu item', () => {
    it('shows "Pause Epic" in overflow menu when epic is not paused', async () => {
      render(
        <EpicHeader
          group={{ ...mockEpic, is_paused: false }}
          isReady={false}
          isCompleted={false}
          doneCount={0}
          totalCount={0}
          onOpenAssistant={vi.fn()}
          onEdit={vi.fn()}
          onToggleReady={vi.fn()}
          onMarkCompleted={vi.fn()}
          onDelete={vi.fn()}
          onTogglePause={vi.fn()}
        />
      )
      await userEvent.click(screen.getByRole('button', { name: /more options/i }))
      expect(screen.getByRole('menuitem', { name: /pause epic/i })).toBeInTheDocument()
    })

    it('shows "Resume Epic" in overflow menu when epic is paused', async () => {
      render(
        <EpicHeader
          group={{ ...mockEpic, is_paused: true }}
          isReady={false}
          isCompleted={false}
          doneCount={0}
          totalCount={0}
          onOpenAssistant={vi.fn()}
          onEdit={vi.fn()}
          onToggleReady={vi.fn()}
          onMarkCompleted={vi.fn()}
          onDelete={vi.fn()}
          onTogglePause={vi.fn()}
        />
      )
      await userEvent.click(screen.getByRole('button', { name: /more options/i }))
      expect(screen.getByRole('menuitem', { name: /resume epic/i })).toBeInTheDocument()
    })

    it('calls onTogglePause when pause menu item is clicked', async () => {
      const onTogglePause = vi.fn()
      render(
        <EpicHeader
          group={{ ...mockEpic, is_paused: false }}
          isReady={false}
          isCompleted={false}
          doneCount={0}
          totalCount={0}
          onOpenAssistant={vi.fn()}
          onEdit={vi.fn()}
          onToggleReady={vi.fn()}
          onMarkCompleted={vi.fn()}
          onDelete={vi.fn()}
          onTogglePause={onTogglePause}
        />
      )
      await userEvent.click(screen.getByRole('button', { name: /more options/i }))
      await userEvent.click(screen.getByRole('menuitem', { name: /pause epic/i }))
      expect(onTogglePause).toHaveBeenCalledOnce()
    })
  })
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npm test -- --run src/renderer/src/components/planner/__tests__/EpicHeader.test.tsx
```

Expected: new tests fail; TypeScript errors about missing `onTogglePause` prop and `is_paused` in mock.

- [ ] **Step 3: Update `EpicHeader.tsx`**

**a) Add `onTogglePause: () => void` to `EpicHeaderProps`** (after `onDelete`):
```typescript
  onTogglePause: () => void
```

**b) Add it to the function destructure:**
```typescript
  onTogglePause
```

**c) Add a handler:**
```typescript
  const handleTogglePauseClick = (): void => {
    setShowOverflowMenu(false)
    onTogglePause()
  }
```

**d) Insert the new menu item in the overflow menu** between "Mark as Ready/Draft" (index 1) and "Mark as Completed" (currently index 2). Shift "Mark as Completed" to index 3 and "Delete" to `isCompleted ? 3 : 4`:

```tsx
            {/* Pause / Resume — index 2 */}
            <button
              ref={(el): void => {
                if (el) menuItemsRef.current[2] = el
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="epic-detail__overflow-item epic-menu__item epic-menu__item--default"
              onClick={handleTogglePauseClick}
            >
              {group.is_paused ? 'Resume Epic' : 'Pause Epic'}
            </button>
            {!isCompleted && (
              <button
                ref={(el): void => {
                  if (el) menuItemsRef.current[3] = el
                }}
                ...
              >
```

And for Delete: `menuItemsRef.current[isCompleted ? 3 : 4] = el`

- [ ] **Step 4: Update `EpicDetail.tsx`**

In `src/renderer/src/components/planner/EpicDetail.tsx`:

Add to props interface (after `onMarkCompleted`):
```typescript
  onTogglePause?: (() => void) | undefined
```

Add to function destructure.

Thread to `<EpicHeader>`:
```tsx
        <EpicHeader
          ...
          onTogglePause={onTogglePause ?? (() => {})}
        />
```

- [ ] **Step 5: Update `PlannerView.tsx`**

In `src/renderer/src/views/PlannerView.tsx`:

Add to the `useTaskGroups` destructure (find where `updateGroup` etc. are pulled):
```typescript
  const { ..., togglePause } = useTaskGroups()
```

Add the handler (after `handleMarkCompleted`):
```typescript
  const handleTogglePause = (): void => {
    if (!selectedGroup) return
    void togglePause(selectedGroup.id)
  }
```

Add to `<EpicDetail>`:
```tsx
                onTogglePause={handleTogglePause}
```

- [ ] **Step 6: Run all tests**

```bash
npm test -- --run src/renderer/src/components/planner/__tests__/EpicHeader.test.tsx
npm run typecheck
npm test -- --run
```

Expected: all tests pass, zero type errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/planner/EpicHeader.tsx \
        src/renderer/src/components/planner/EpicDetail.tsx \
        src/renderer/src/views/PlannerView.tsx \
        src/renderer/src/components/planner/__tests__/EpicHeader.test.tsx
git commit -m "feat(epics): add Pause/Resume Epic to overflow menu"
```

---

## Self-Review

**Spec coverage:**
- ✅ Migration v056 adds `is_paused INTEGER NOT NULL DEFAULT 0` (Task 1)
- ✅ `TaskGroup.is_paused: boolean` (Task 1)
- ✅ Migration test: column exists, existing rows default to 0, new rows default to 0, idempotent (Task 1)
- ✅ `sanitizeGroup` coerces `row.is_paused === 1` to boolean (Task 2)
- ✅ `UpdateGroupInput.is_paused?: boolean` (Task 2)
- ✅ `updateGroup` allowlist + serialization boolean→integer (Task 2)
- ✅ `getQueuedTasks` LEFT JOIN excludes paused epic tasks, includes ungrouped tasks (Task 2)
- ✅ `groups:update` IPC patch type includes `is_paused` (Task 3)
- ✅ `togglePause` store action with optimistic update + toast (Task 3)
- ✅ "Pause Epic" / "Resume Epic" menu item in EpicHeader (Task 4)
- ✅ Active running tasks unaffected — only NEW claims are blocked (SQL filter only touches `status='queued'`)

**Type consistency:** `is_paused: boolean` in `TaskGroup` type, `is_paused?: boolean` in `UpdateGroupInput` and IPC patch type. `togglePause(id: string)` in store interface and implementation. `onTogglePause: () => void` in `EpicHeaderProps`; `onTogglePause?: (() => void) | undefined` in `EpicDetailProps` (optional to allow existing call sites without immediate update).
