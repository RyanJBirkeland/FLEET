# Tier 3: Strategic Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured metrics, consolidate logging, auto-prune task_changes, align design tokens, add keyboard navigation, and add retry backoff.

**Architecture:** Six independent tasks. All can be parallelized. Tasks 11-13 are backend-only. Tasks 14-15 are renderer-only. Task 16 spans both.

**Tech Stack:** TypeScript, React, Zustand, vitest, better-sqlite3, CSS

**Spec:** `docs/superpowers/specs/2026-04-03-task-pipeline-csuite-audit.md` (Tier 3 section)

---

### Task 11: Implement structured metrics

Add counters for drain loop executions, agents spawned/failed/completed, watchdog kills by verdict, and retry count. Surface via IPC to Dashboard.

**Files:**

- Create: `src/main/agent-manager/metrics.ts`
- Create: `src/main/__tests__/integration/agent-metrics.test.ts`
- Modify: `src/main/agent-manager/index.ts` (increment counters)
- Modify: `src/main/agent-manager/types.ts` (add metrics type)
- Modify: `src/preload/index.ts` (expose IPC channel)
- Modify: `src/preload/index.d.ts` (type declaration)
- Modify: `src/renderer/src/views/DashboardView.tsx` (display metrics)

- [ ] **Step 1: Write test for metrics module**

```typescript
import { createMetricsCollector } from '../metrics'

describe('MetricsCollector', () => {
  it('starts with zero counters', () => {
    const metrics = createMetricsCollector()
    const snapshot = metrics.snapshot()
    expect(snapshot.drainLoopCount).toBe(0)
    expect(snapshot.agentsSpawned).toBe(0)
    expect(snapshot.agentsFailed).toBe(0)
  })

  it('increments counters', () => {
    const metrics = createMetricsCollector()
    metrics.increment('drainLoopCount')
    metrics.increment('drainLoopCount')
    metrics.increment('agentsSpawned')
    const snapshot = metrics.snapshot()
    expect(snapshot.drainLoopCount).toBe(2)
    expect(snapshot.agentsSpawned).toBe(1)
  })

  it('tracks watchdog verdicts by type', () => {
    const metrics = createMetricsCollector()
    metrics.recordWatchdogVerdict('idle')
    metrics.recordWatchdogVerdict('idle')
    metrics.recordWatchdogVerdict('max-runtime')
    const snapshot = metrics.snapshot()
    expect(snapshot.watchdogVerdicts.idle).toBe(2)
    expect(snapshot.watchdogVerdicts['max-runtime']).toBe(1)
  })

  it('resets counters', () => {
    const metrics = createMetricsCollector()
    metrics.increment('agentsSpawned')
    metrics.reset()
    expect(metrics.snapshot().agentsSpawned).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config src/main/vitest.main.config.ts -t "MetricsCollector"`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement metrics collector**

Create `src/main/agent-manager/metrics.ts`:

```typescript
export interface MetricsSnapshot {
  drainLoopCount: number
  agentsSpawned: number
  agentsCompleted: number
  agentsFailed: number
  retriesQueued: number
  watchdogVerdicts: Record<string, number>
  lastDrainDurationMs: number
  uptimeMs: number
}

type CounterKey = keyof Omit<
  MetricsSnapshot,
  'watchdogVerdicts' | 'lastDrainDurationMs' | 'uptimeMs'
>

export interface MetricsCollector {
  increment(key: CounterKey): void
  recordWatchdogVerdict(verdict: string): void
  setLastDrainDuration(ms: number): void
  snapshot(): MetricsSnapshot
  reset(): void
}

export function createMetricsCollector(): MetricsCollector {
  const startTime = Date.now()
  let counters: Record<string, number> = {}
  let watchdogVerdicts: Record<string, number> = {}
  let lastDrainDurationMs = 0

  return {
    increment(key: CounterKey) {
      counters[key] = (counters[key] ?? 0) + 1
    },
    recordWatchdogVerdict(verdict: string) {
      watchdogVerdicts[verdict] = (watchdogVerdicts[verdict] ?? 0) + 1
    },
    setLastDrainDuration(ms: number) {
      lastDrainDurationMs = ms
    },
    snapshot(): MetricsSnapshot {
      return {
        drainLoopCount: counters.drainLoopCount ?? 0,
        agentsSpawned: counters.agentsSpawned ?? 0,
        agentsCompleted: counters.agentsCompleted ?? 0,
        agentsFailed: counters.agentsFailed ?? 0,
        retriesQueued: counters.retriesQueued ?? 0,
        watchdogVerdicts: { ...watchdogVerdicts },
        lastDrainDurationMs,
        uptimeMs: Date.now() - startTime
      }
    },
    reset() {
      counters = {}
      watchdogVerdicts = {}
      lastDrainDurationMs = 0
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config src/main/vitest.main.config.ts -t "MetricsCollector"`
Expected: ALL PASS

- [ ] **Step 5: Wire into AgentManager**

In `src/main/agent-manager/index.ts`:

- Create a metrics collector instance in the constructor
- Call `metrics.increment('drainLoopCount')` at the start of each drain cycle
- Call `metrics.increment('agentsSpawned')` when spawning
- Call `metrics.increment('agentsCompleted')` / `metrics.increment('agentsFailed')` in completion
- Call `metrics.recordWatchdogVerdict(verdict)` in `handleWatchdogVerdict`
- Register an IPC handler `agentManager:metrics` that returns `metrics.snapshot()`

- [ ] **Step 6: Add IPC channel and preload bridge**

Register `agentManager:metrics` in `src/main/index.ts` via `safeHandle`. Add to `src/preload/index.ts` and `src/preload/index.d.ts`.

- [ ] **Step 7: Display in Dashboard**

In `DashboardView.tsx`, fetch metrics via IPC on poll interval. Show key counters (agents spawned, completed, failed, uptime) in a new "Engine" section.

- [ ] **Step 8: Run full test suites**

Run: `npm test && npm run test:main && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add src/main/agent-manager/metrics.ts \
        src/main/agent-manager/index.ts \
        src/main/__tests__/ \
        src/main/index.ts \
        src/preload/ \
        src/renderer/src/views/DashboardView.tsx
git commit -m "feat: add structured metrics for agent manager

Tracks drain loop count, agents spawned/completed/failed, watchdog
verdicts by type, and drain duration. Exposed via IPC and displayed
in Dashboard. Replaces log-file-only observability."
```

---

### Task 12: Consolidate logging infrastructure

Eliminate the dual logging in `agent-manager/index.ts` (inline `fileLog`) and have it use `createLogger('agent-manager')`. Add correlation IDs. Increase rotation to 3 generations.

**Files:**

- Modify: `src/main/logger.ts` (add correlation ID support, 3 generations)
- Modify: `src/main/agent-manager/index.ts` (remove inline fileLog, use createLogger)
- Test: `src/main/__tests__/` (update logger tests if they exist)

- [ ] **Step 1: Write test for 3-generation rotation**

```typescript
it('keeps 3 log generations on rotation', () => {
  // Create a logger with small max size
  // Write enough to trigger rotation
  // Verify .old.1, .old.2 files exist
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — only 1 generation currently

- [ ] **Step 3: Update logger to support multiple generations**

In `src/main/logger.ts`, modify the rotation logic:

- Rename existing `.old` to `.old.2` before renaming current to `.old`
- Keep 3 generations: `.log`, `.old`, `.old.2`
- Delete `.old.2` if it exists before rotating

- [ ] **Step 4: Add optional correlation ID to log format**

```typescript
export function createLogger(name: string) {
  // ... existing code ...
  return {
    info: (msg: string, correlationId?: string) => {
      const prefix = correlationId ? ` [${correlationId}]` : ''
      write(`[INFO] [${name}]${prefix} ${msg}`)
    }
    // ... same for warn, error
  }
}
```

- [ ] **Step 5: Remove inline `fileLog` from agent-manager**

In `src/main/agent-manager/index.ts`, remove the inline `fileLog` function (lines ~60-76) and the `agent-manager.log` path. Replace all `fileLog()` calls with `this.logger.info()` / `this.logger.error()` using the injected logger (which should be `createLogger('agent-manager')`).

Pass the task ID as correlation ID: `this.logger.info('Claiming task', taskId)`

- [ ] **Step 6: Run full test suites**

Run: `npm test && npm run test:main && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/main/logger.ts src/main/agent-manager/index.ts
git commit -m "refactor: consolidate logging to single createLogger system

Removes the inline fileLog in agent-manager that wrote to a
separate agent-manager.log. All logging now flows through
createLogger with correlation IDs and 3-generation rotation."
```

---

### Task 13: Schedule `pruneOldChanges()` automatically

Wire `pruneOldChanges()` from `task-changes.ts` into the existing startup/periodic maintenance cycle.

**Files:**

- Modify: `src/main/index.ts` (add to startup routine)

- [ ] **Step 1: Add pruning to startup**

In `src/main/index.ts`, near the existing backup logic, add:

```typescript
import { pruneOldChanges } from './data/task-changes'

// At startup, after DB init:
try {
  const pruned = pruneOldChanges(30) // Keep 30 days
  if (pruned > 0) logger.info(`Pruned ${pruned} old task change records`)
} catch (err) {
  logger.warn(`Failed to prune task changes: ${err}`)
}
```

Also add a 24-hour interval (alongside the existing backup interval):

```typescript
setInterval(
  () => {
    try {
      pruneOldChanges(30)
    } catch {
      /* logged inside */
    }
  },
  24 * 60 * 60 * 1000
)
```

- [ ] **Step 2: Run full test suites**

Run: `npm test && npm run test:main && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "chore: auto-prune task_changes table on startup and daily

pruneOldChanges(30) was implemented but never called from production
code. Now runs at startup and every 24 hours, keeping 30 days of
audit history. Prevents unbounded table growth."
```

---

### Task 14: Design token alignment pass

Audit neon CSS files, replace hardcoded font sizes with token references, standardize border tokens, add a `10px` token.

**Files:**

- Modify: `src/renderer/src/design-system/tokens.ts` (add `2xs: '10px'`)
- Modify: `src/renderer/src/assets/neon.css` or `base.css` (add CSS custom property)
- Modify: `src/renderer/src/assets/sprint-pipeline-neon.css`
- Modify: `src/renderer/src/assets/code-review-neon.css`
- Modify: `src/renderer/src/assets/task-workbench-neon.css`

- [ ] **Step 1: Add `2xs` token to design system**

In `src/renderer/src/design-system/tokens.ts`, add `2xs: '10px'` to the font size scale:

```typescript
fontSize: {
  '2xs': '10px',  // New — most common small size in codebase
  xs: '11px',
  sm: '12px',
  // ... existing
}
```

Add corresponding CSS custom property in `neon.css` or `base.css`:

```css
:root {
  --font-2xs: 10px;
}
```

- [ ] **Step 2: Replace hardcoded `10px` font sizes in pipeline CSS**

In `sprint-pipeline-neon.css`, find all `font-size: 10px` occurrences and replace with `font-size: var(--font-2xs, 10px)`. Similarly for `11px` → `var(--font-xs, 11px)` and `12px` → `var(--font-sm, 12px)`.

- [ ] **Step 3: Standardize border tokens**

Replace `var(--neon-purple-border)` in `code-review-neon.css` for structural borders with `var(--bde-border)` to match pipeline convention. Keep accent borders (decorative glow) on `var(--neon-*-border)`.

- [ ] **Step 4: Remove `!important` overrides**

In `sprint-pipeline-neon.css:402,525-526`, increase selector specificity instead of using `!important`. For example, `.pipeline-stage .pipeline-stage__dot--dim` instead of `.pipeline-stage__dot--dim !important`.

- [ ] **Step 5: Fix mixed `rem`/`px` units**

In `sprint-pipeline-neon.css:125,129,134`, replace `rem` values with `px` to match the rest of the file and the `px`-based token system.

- [ ] **Step 6: Run full test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL PASS (CSS-only changes shouldn't break tests, but verify)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/design-system/tokens.ts \
        src/renderer/src/assets/
git commit -m "chore: align design tokens — add 2xs font, standardize borders

Adds 10px as 2xs token (most common small size in codebase).
Standardizes structural borders to var(--bde-border). Removes
!important overrides. Fixes mixed rem/px units in pipeline CSS."
```

---

### Task 15: Add keyboard navigation in Pipeline and Code Review

Add roving tab index within pipeline stages and j/k shortcuts in the review queue.

**Files:**

- Modify: `src/renderer/src/components/sprint/PipelineStage.tsx`
- Modify: `src/renderer/src/components/code-review/ReviewQueue.tsx`
- Modify: `src/renderer/src/hooks/useRovingTabIndex.ts` (verify reusability)
- Test: Component tests for both

- [ ] **Step 1: Write test for arrow key navigation in pipeline stage**

```typescript
it('supports arrow key navigation between task pills', async () => {
  render(
    <PipelineStage
      label="Active"
      tasks={[mockTask1, mockTask2, mockTask3]}
      onTaskClick={vi.fn()}
    />
  )
  const pills = screen.getAllByRole('button')
  pills[0].focus()
  await userEvent.keyboard('{ArrowDown}')
  expect(pills[1]).toHaveFocus()
  await userEvent.keyboard('{ArrowUp}')
  expect(pills[0]).toHaveFocus()
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — no arrow key handling

- [ ] **Step 3: Add `useRovingTabIndex` to PipelineStage**

Use the existing `src/renderer/src/hooks/useRovingTabIndex.ts` hook on the card container within each `PipelineStage`. This provides ArrowUp/ArrowDown/Home/End navigation.

- [ ] **Step 4: Write test for j/k in ReviewQueue**

```typescript
it('supports j/k shortcuts to cycle review tasks', async () => {
  // Setup code review store with multiple tasks
  render(<ReviewQueue />)
  await userEvent.keyboard('j') // next
  // Verify second task is focused/selected
  await userEvent.keyboard('k') // prev
  // Verify first task is focused/selected
})
```

- [ ] **Step 5: Add j/k keyboard handler to ReviewQueue**

In `ReviewQueue.tsx`, add a `useEffect` that listens for `j` (next) and `k` (previous) key presses and updates the selected task index.

- [ ] **Step 6: Run full test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/sprint/PipelineStage.tsx \
        src/renderer/src/components/code-review/ReviewQueue.tsx \
        src/renderer/src/components/sprint/__tests__/ \
        src/renderer/src/components/code-review/__tests__/
git commit -m "feat(a11y): add keyboard navigation in Pipeline and Code Review

Pipeline stages now support ArrowUp/ArrowDown/Home/End between task
pills via roving tab index. Review queue supports j/k shortcuts
for cycling tasks, matching developer tool conventions."
```

---

### Task 16: Add retry backoff for requeued tasks

Currently, a failed task requeued to `queued` is immediately picked up on the next drain cycle. Add a cooldown period.

**Files:**

- Modify: `src/main/data/sprint-queries.ts` (add `next_eligible_at` consideration)
- Modify: `src/main/agent-manager/index.ts` or `completion.ts` (set cooldown on retry)
- Modify: `src/main/db.ts` (migration to add `next_eligible_at` column)
- Test: `src/main/__tests__/integration/`

- [ ] **Step 1: Write test for retry backoff**

```typescript
it('does not claim tasks before their next_eligible_at time', () => {
  // Create a task with next_eligible_at 5 minutes in the future
  const futureTime = new Date(Date.now() + 300000).toISOString()
  createTask({ ...baseTask, status: 'queued' })
  updateTask(taskId, { next_eligible_at: futureTime })

  const queued = getQueuedTasks(10)
  expect(queued.find((t) => t.id === taskId)).toBeUndefined()
})

it('claims tasks after their next_eligible_at time has passed', () => {
  const pastTime = new Date(Date.now() - 1000).toISOString()
  createTask({ ...baseTask, status: 'queued' })
  updateTask(taskId, { next_eligible_at: pastTime })

  const queued = getQueuedTasks(10)
  expect(queued.find((t) => t.id === taskId)).toBeDefined()
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — `next_eligible_at` column doesn't exist

- [ ] **Step 3: Add migration for `next_eligible_at` column**

In `src/main/db.ts`, add a new migration:

```typescript
{
  version: 23,
  description: 'Add next_eligible_at for retry backoff',
  up(db) {
    db.exec(`ALTER TABLE sprint_tasks ADD COLUMN next_eligible_at TEXT`)
  }
}
```

- [ ] **Step 4: Update `getQueuedTasks` to respect `next_eligible_at`**

In `src/main/data/sprint-queries.ts`, modify `getQueuedTasks` query:

```sql
SELECT * FROM sprint_tasks
WHERE status = 'queued' AND claimed_by IS NULL
AND (next_eligible_at IS NULL OR next_eligible_at <= datetime('now'))
ORDER BY priority ASC, created_at ASC
LIMIT ?
```

- [ ] **Step 5: Set backoff on retry**

In `src/main/agent-manager/completion.ts` (or wherever retry requeue happens), when setting status back to `queued`, also set `next_eligible_at`:

```typescript
const backoffMs = Math.min(300000, 30000 * Math.pow(2, retryCount)) // 30s, 60s, 120s, 240s, cap 5min
const nextEligibleAt = new Date(Date.now() + backoffMs).toISOString()
repo.updateTask(taskId, {
  status: 'queued',
  claimed_by: null,
  next_eligible_at: nextEligibleAt
})
```

- [ ] **Step 6: Add `next_eligible_at` to UPDATE_ALLOWLIST**

In `sprint-queries.ts`, add `'next_eligible_at'` to the `UPDATE_ALLOWLIST` Set.

- [ ] **Step 7: Add to sprint_tasks column list documentation**

Update the CLAUDE.md gotcha about `sprint_tasks full column list` to include `next_eligible_at`.

- [ ] **Step 8: Run full test suites**

Run: `npm test && npm run test:main && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add src/main/db.ts \
        src/main/data/sprint-queries.ts \
        src/main/agent-manager/completion.ts \
        src/main/__tests__/
git commit -m "feat: add exponential retry backoff for requeued tasks

Failed tasks that are requeued now have a next_eligible_at cooldown
(30s * 2^retryCount, capped at 5min). Prevents tight retry loops
that consume agent slots for systematically failing tasks."
```
