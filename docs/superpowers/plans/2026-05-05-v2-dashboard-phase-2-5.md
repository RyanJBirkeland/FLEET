# V2 Dashboard Phase 2.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire quality scores (DB write-back from `task_reviews` → `sprint_tasks`) and live agent step descriptions (latest `AgentEvent` → `ActiveAgentsCard`) into the V2 Dashboard, removing four `TODO(phase-2.5)` stubs.

**Architecture:** (1) A new nullable `quality_score INTEGER` column on `sprint_tasks` is written back by `review-service.ts` after every successful structured review. The dashboard reads it from `SprintTask` objects it already holds — no new IPC channel. (2) `sprintEvents` store already captures live agent events per task; a new `latestEventForTask` helper extracts the most recent event, and `describeAgentStep` converts it to a human-readable string threaded into `ActiveAgent.stepDescription`.

**Tech Stack:** TypeScript, React, Zustand, better-sqlite3, Vitest

---

### Task 1: Migration v062 — add `quality_score` to `sprint_tasks`

**Files:**
- Create: `src/main/migrations/v062-add-quality-score-to-sprint-tasks.ts`
- Create: `src/main/migrations/__tests__/v062.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/main/migrations/__tests__/v062.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { up, version } from '../v062-add-quality-score-to-sprint-tasks'

describe('migration v062', () => {
  it('has version 62', () => {
    expect(version).toBe(62)
  })

  it('adds nullable quality_score column to sprint_tasks', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE sprint_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)`)
    db.exec(`INSERT INTO sprint_tasks (id, title) VALUES ('t1', 'Task one')`)

    up(db)

    const row = db.prepare('SELECT quality_score FROM sprint_tasks WHERE id = ?').get('t1') as {
      quality_score: number | null
    }
    expect(row.quality_score).toBeNull()
  })

  it('allows setting quality_score to an integer', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE sprint_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)`)
    db.exec(`INSERT INTO sprint_tasks (id, title) VALUES ('t1', 'Task one')`)
    up(db)

    db.prepare('UPDATE sprint_tasks SET quality_score = ? WHERE id = ?').run(88, 't1')

    const row = db.prepare('SELECT quality_score FROM sprint_tasks WHERE id = ?').get('t1') as {
      quality_score: number
    }
    expect(row.quality_score).toBe(88)
  })

  it('is idempotent (IF NOT EXISTS guard)', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE sprint_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)`)
    expect(() => {
      up(db)
      up(db)
    }).not.toThrow()
    db.close()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/main/migrations/__tests__/v062.test.ts
```

Expected: FAIL with "Cannot find module '../v062-add-quality-score-to-sprint-tasks'"

- [ ] **Step 3: Write the migration**

Create `src/main/migrations/v062-add-quality-score-to-sprint-tasks.ts`:

```ts
import type Database from 'better-sqlite3'

export const version = 62
export const description = 'Add quality_score column to sprint_tasks for reviewer write-back'

export const up = (db: Database.Database): void => {
  const sql = `ALTER TABLE sprint_tasks ADD COLUMN IF NOT EXISTS quality_score INTEGER`
  db.exec(sql)
}
```

> Note: SQLite supports `ADD COLUMN IF NOT EXISTS` since SQLite 3.37.0 (Nov 2021). better-sqlite3 ships a bundled SQLite that's well past that. This makes the migration safe to run twice.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/main/migrations/__tests__/v062.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/migrations/v062-add-quality-score-to-sprint-tasks.ts src/main/migrations/__tests__/v062.test.ts
git commit -m "feat(db): migration v062 — add quality_score to sprint_tasks"
```

---

### Task 2: SprintTask type + mapper

**Files:**
- Modify: `src/shared/types/task-types.ts` — add `quality_score?: number` to `SprintTask`
- Modify: `src/main/data/sprint-task-mapper.ts` — pick up the field in `mapRowToTask`

- [ ] **Step 1: Add `quality_score` to `SprintTask`**

In `src/shared/types/task-types.ts`, add the field after `verification_results` (line ~173):

```ts
  verification_results?: VerificationResults | null
  /**
   * Quality score (0–100) written back by the auto-reviewer after a structured
   * review completes. Null until a review has run for this task.
   */
  quality_score?: number
  updated_at: string
  created_at: string
```

- [ ] **Step 2: Pick up `quality_score` in `mapRowToTask`**

In `src/main/data/sprint-task-mapper.ts`, add the field after `verification_results` in the returned object (around line 208):

```ts
    verification_results: parseVerificationResults(row.verification_results),
    quality_score: toOptionalInt(row.quality_score) ?? undefined,
    review_diff_snapshot: toOptionalString(row.review_diff_snapshot),
```

- [ ] **Step 3: Run typecheck and tests**

```bash
npm run typecheck && npm test
```

Expected: zero type errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/task-types.ts src/main/data/sprint-task-mapper.ts
git commit -m "feat(types): add quality_score field to SprintTask + mapper"
```

---

### Task 3: Review service write-back

**Files:**
- Modify: `src/main/services/review-service.ts` — call `taskRepo.updateTask` after `repo.setCached`
- Modify: `src/main/services/review-service.test.ts` — new test for write-back

- [ ] **Step 1: Write the failing test**

In `src/main/services/review-service.test.ts`, add a new test inside the `describe('reviewService.reviewChanges', ...)` block:

```ts
  it('writes quality_score back to the task after a successful review', async () => {
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = []
    const taskRepo = {
      ...makeFakeTaskRepo(),
      updateTask: async (id: string, patch: Record<string, unknown>) => {
        updates.push({ id, patch })
        return null
      }
    }
    const svc = createReviewService(baseDeps({ taskRepo }))

    await svc.reviewChanges('task-1')

    expect(updates).toHaveLength(1)
    expect(updates[0]?.id).toBe('task-1')
    expect(updates[0]?.patch).toEqual({ quality_score: 88 })
  })
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/main/services/review-service.test.ts
```

Expected: FAIL — `updates` is empty (write-back not implemented yet)

- [ ] **Step 3: Add the write-back to `review-service.ts`**

In `src/main/services/review-service.ts`, after `repo.setCached(taskId, headSha, result, raw)` (line ~138), add:

```ts
      repo.setCached(taskId, headSha, result, raw)
      await taskRepo.updateTask(taskId, { quality_score: result.qualityScore }, { caller: 'review-service' })
      return result
```

- [ ] **Step 4: Update `makeFakeTaskRepo` to include `updateTask` stub**

The existing `makeFakeTaskRepo` returns `{ getTask }` cast as `any`. Tests that don't check for `updateTask` will now call the real `taskRepo.updateTask` (a no-op on the fake). Confirm existing tests still pass without changes — the `baseDeps` helper uses `makeFakeTaskRepo()` which returns an object cast as `any`, so the call will succeed silently unless the test overrides it.

- [ ] **Step 5: Run all review-service tests**

```bash
npx vitest run src/main/services/review-service.test.ts
```

Expected: PASS (all tests including the new one)

- [ ] **Step 6: Commit**

```bash
git add src/main/services/review-service.ts src/main/services/review-service.test.ts
git commit -m "feat(review): write quality_score back to sprint_tasks after structured review"
```

---

### Task 4: `describeAgentStep` utility

**Files:**
- Create: `src/renderer/src/lib/describeAgentStep.ts`
- Create: `src/renderer/src/lib/__tests__/describeAgentStep.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/src/lib/__tests__/describeAgentStep.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { describeAgentStep } from '../describeAgentStep'

describe('describeAgentStep', () => {
  it('returns "running…" for undefined', () => {
    expect(describeAgentStep(undefined)).toBe('running…')
  })

  it('formats agent:tool_call with tool and summary', () => {
    expect(
      describeAgentStep({ type: 'agent:tool_call', tool: 'Read', summary: 'src/foo.ts' })
    ).toBe('$ Read: src/foo.ts')
  })

  it('truncates agent:tool_call at 52 chars', () => {
    const longSummary = 'a'.repeat(60)
    const result = describeAgentStep({ type: 'agent:tool_call', tool: 'Bash', summary: longSummary })
    expect(result.length).toBe(52)
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns "running…" for agent:tool_call with missing fields', () => {
    expect(describeAgentStep({ type: 'agent:tool_call' })).toBe('running…')
  })

  it('formats agent:text with first non-empty line', () => {
    expect(
      describeAgentStep({ type: 'agent:text', text: '\nLooking at the file\nMore text' })
    ).toBe('Looking at the file')
  })

  it('truncates agent:text at 52 chars', () => {
    const longText = 'b'.repeat(80)
    const result = describeAgentStep({ type: 'agent:text', text: longText })
    expect(result.length).toBe(52)
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns "running…" for agent:text with only whitespace', () => {
    expect(describeAgentStep({ type: 'agent:text', text: '   \n  ' })).toBe('running…')
  })

  it('returns "running…" for agent:started', () => {
    expect(describeAgentStep({ type: 'agent:started' })).toBe('running…')
  })

  it('returns "running…" for agent:thinking', () => {
    expect(describeAgentStep({ type: 'agent:thinking' })).toBe('running…')
  })

  it('returns "running…" for agent:completed', () => {
    expect(describeAgentStep({ type: 'agent:completed' })).toBe('running…')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/renderer/src/lib/__tests__/describeAgentStep.test.ts
```

Expected: FAIL — "Cannot find module '../describeAgentStep'"

- [ ] **Step 3: Write the implementation**

Create `src/renderer/src/lib/describeAgentStep.ts`:

```ts
const MAX_LEN = 52

function truncate(s: string): string {
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1) + '…' : s
}

export function describeAgentStep(
  event: { type: string; tool?: string; summary?: string; text?: string } | undefined
): string {
  if (!event) return 'running…'

  if (event.type === 'agent:tool_call' && event.tool != null && event.summary != null) {
    return truncate(`$ ${event.tool}: ${event.summary}`)
  }

  if (event.type === 'agent:text' && event.text != null) {
    const firstLine = event.text.split('\n').find((l) => l.trim() !== '') ?? ''
    return firstLine ? truncate(firstLine) : 'running…'
  }

  return 'running…'
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/renderer/src/lib/__tests__/describeAgentStep.test.ts
```

Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/describeAgentStep.ts src/renderer/src/lib/__tests__/describeAgentStep.test.ts
git commit -m "feat(lib): describeAgentStep — derive step label from latest AgentEvent"
```

---

### Task 5: Thread quality scores into the dashboard

**Files:**
- Modify: `src/renderer/src/components/dashboard/hooks/useDashboardData.ts`
- Modify: `src/renderer/src/components/dashboard/TriageColumn/RecentCompletionsCard.tsx`
- Modify: `src/renderer/src/components/dashboard/StatsAccordion/PerAgentStats.tsx`

- [ ] **Step 1: Update `PerAgentRow.quality` type**

In `useDashboardData.ts`, change the `PerAgentRow` interface — replace the TODO comment and `null` type:

```ts
export interface PerAgentRow {
  name: string
  runs: number
  successPct: number | null
  avgDurationMs: number | null
  totalTokens: number
  quality: number | null
}
```

- [ ] **Step 2: Update `derivePerAgentStats` to accept and use a quality map**

Replace the entire `derivePerAgentStats` function in `useDashboardData.ts`:

```ts
function derivePerAgentStats(
  agents: AgentCostRecord[],
  taskQualityMap: Map<string, number>
): PerAgentRow[] {
  const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS
  const recent = agents.filter((a) => new Date(a.startedAt).getTime() >= sevenDaysAgo)

  const byName = new Map<string, AgentCostRecord[]>()
  for (const a of recent) {
    const name = a.taskTitle ?? 'unknown'
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name)!.push(a)
  }

  return Array.from(byName.entries())
    .map(([name, runs]) => {
      const withDuration = runs.filter((r) => r.durationMs != null && r.durationMs > 0)
      const avgDurationMs =
        withDuration.length > 0
          ? withDuration.reduce((s, r) => s + r.durationMs!, 0) / withDuration.length
          : null
      const totalTokens = runs.reduce((s, r) => s + (r.tokensIn ?? 0) + (r.tokensOut ?? 0), 0)
      const withCost = runs.filter((r) => r.costUsd != null)
      const successCount = withCost.filter((r) => r.finishedAt != null).length

      const qualityScores = runs
        .filter((r) => r.sprintTaskId != null && taskQualityMap.has(r.sprintTaskId))
        .map((r) => taskQualityMap.get(r.sprintTaskId!)!)
      const quality =
        qualityScores.length > 0
          ? Math.round(qualityScores.reduce((s, q) => s + q, 0) / qualityScores.length)
          : null

      return {
        name,
        runs: runs.length,
        successPct: runs.length > 0 ? Math.round((successCount / runs.length) * 100) : null,
        avgDurationMs,
        totalTokens,
        quality
      }
    })
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 6)
}
```

- [ ] **Step 3: Build the quality map and pass it in `useDashboardData`**

In `useDashboardData`, add the quality map computation after the `tasks` subscription and update the `perAgentStats` memo. Find the line `const tasks = useSprintTasks((s) => s.tasks)` and after all the existing memos, add:

```ts
  const taskQualityMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const task of tasks) {
      if (task.quality_score != null) map.set(task.id, task.quality_score)
    }
    return map
  }, [tasks])

  const perAgentStats = useMemo(
    () => derivePerAgentStats(localAgents, taskQualityMap),
    [localAgents, taskQualityMap]
  )
```

Remove the old `const perAgentStats = useMemo(() => derivePerAgentStats(localAgents), [localAgents])` line.

- [ ] **Step 4: Update `RecentCompletionsCard` to use real quality scores**

In `src/renderer/src/components/dashboard/TriageColumn/RecentCompletionsCard.tsx`, replace the TODO comment and hardcoded `null`:

```tsx
              <QualityChip q={task.quality_score ?? null} />
```

Remove the `{/* TODO(phase-2.5): ... */}` comment.

- [ ] **Step 5: Update `PerAgentStats` to use `QualityChip`**

In `src/renderer/src/components/dashboard/StatsAccordion/PerAgentStats.tsx`:

Add the import at the top:
```tsx
import { QualityChip } from '../primitives/QualityChip'
```

Replace the TODO comment and the `—` span for the quality column:
```tsx
          <span className="per-agent__col-q">
            {row.quality != null ? <QualityChip q={row.quality} /> : '—'}
          </span>
```

- [ ] **Step 6: Run typecheck and tests**

```bash
npm run typecheck && npm test
```

Expected: zero type errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/dashboard/hooks/useDashboardData.ts \
        src/renderer/src/components/dashboard/TriageColumn/RecentCompletionsCard.tsx \
        src/renderer/src/components/dashboard/StatsAccordion/PerAgentStats.tsx
git commit -m "feat(dashboard): wire quality_score into RecentCompletionsCard and PerAgentStats"
```

---

### Task 6: Thread step descriptions into the dashboard

**Files:**
- Modify: `src/renderer/src/stores/sprintEvents.ts` — export `latestEventForTask`
- Modify: `src/renderer/src/components/dashboard/hooks/useDashboardData.ts` — subscribe to sprintEvents, thread into `deriveActiveAgents`
- Modify: `src/renderer/src/components/dashboard/LiveColumn/ActiveAgentsCard.tsx` — use `agent.stepDescription`

- [ ] **Step 1: Export `latestEventForTask` from `sprintEvents.ts`**

In `src/renderer/src/stores/sprintEvents.ts`, add this function after the `selectLatestEvent` definition:

```ts
/**
 * Pure ring-buffer lookup for use outside of React hooks.
 * Reads the most recent event for `taskId` from a `taskEvents` snapshot.
 */
export function latestEventForTask(
  taskEvents: SprintEventsState['taskEvents'],
  taskId: string
): AnyTaskEvent | undefined {
  const buf = taskEvents[taskId]
  if (!buf || buf.count === 0) return undefined
  const lastSlot = (buf.head - 1 + buf.size) % buf.size
  return buf.items[lastSlot]
}
```

- [ ] **Step 2: Add `stepDescription` to the `ActiveAgent` interface**

In `useDashboardData.ts`, update the `ActiveAgent` interface:

```ts
export interface ActiveAgent {
  id: string
  title: string
  repo: string
  tokens: number
  elapsedMs: number
  progressPct: number | null
  startedAt: string | null
  stepDescription: string
}
```

- [ ] **Step 3: Update `deriveActiveAgents` to accept `taskEvents` and produce `stepDescription`**

Add the necessary imports at the top of `useDashboardData.ts`:

```ts
import { useSprintEvents, latestEventForTask, type SprintEventsState } from '../../../stores/sprintEvents'
import { describeAgentStep } from '../../../lib/describeAgentStep'
```

Replace the entire `deriveActiveAgents` function:

```ts
function deriveActiveAgents(
  inProgress: SprintTask[],
  taskTokenMap: Map<string, number>,
  taskEvents: SprintEventsState['taskEvents'],
  now: number
): ActiveAgent[] {
  return inProgress.slice(0, 5).map((task) => {
    const startedMs = task.started_at ? new Date(task.started_at).getTime() : now
    const elapsedMs = now - startedMs
    const progressPct =
      task.max_runtime_ms != null
        ? Math.min(100, Math.round((elapsedMs / task.max_runtime_ms) * 100))
        : null
    const latestEvent = latestEventForTask(taskEvents, task.id)
    return {
      id: task.id,
      title: task.title,
      repo: task.repo,
      tokens: taskTokenMap.get(task.id) ?? 0,
      elapsedMs,
      progressPct,
      startedAt: task.started_at ?? null,
      stepDescription: describeAgentStep(latestEvent)
    }
  })
}
```

- [ ] **Step 4: Subscribe to `sprintEvents` and wire into `activeAgents` memo**

In `useDashboardData`, add the subscription after the existing store hooks:

```ts
  const taskEvents = useSprintEvents((s) => s.taskEvents)
```

Update the `activeAgents` memo to pass `taskEvents`:

```ts
  const activeAgents = useMemo(
    () => deriveActiveAgents(partitions.inProgress, taskTokenMap, taskEvents, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partitions.inProgress, taskTokenMap, taskEvents]
  )
```

- [ ] **Step 5: Update `ActiveAgentsCard` to render `stepDescription`**

In `src/renderer/src/components/dashboard/LiveColumn/ActiveAgentsCard.tsx`, replace the TODO comment and hardcoded step span:

```tsx
        <span className="active-agents__step">
          <span className="active-agents__dollar">$ </span>{agent.stepDescription.startsWith('$ ')
            ? agent.stepDescription.slice(2)
            : agent.stepDescription}
        </span>
```

Wait — `describeAgentStep` already prefixes tool calls with `$ `. The component template wraps with `<span className="active-agents__dollar">$ </span>`. To avoid double `$`:

Replace the entire step block:

```tsx
        <span className="active-agents__step">{agent.stepDescription}</span>
```

And remove the `active-agents__dollar` span since `describeAgentStep` includes the `$` in tool_call descriptions. This keeps the formatting consistent across event types.

- [ ] **Step 6: Run typecheck and tests**

```bash
npm run typecheck && npm test
```

Expected: zero type errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/stores/sprintEvents.ts \
        src/renderer/src/components/dashboard/hooks/useDashboardData.ts \
        src/renderer/src/components/dashboard/LiveColumn/ActiveAgentsCard.tsx
git commit -m "feat(dashboard): live agent step descriptions from sprintEvents in ActiveAgentsCard"
```

---

### Task 7: Module docs + final checks

**Files:**
- Modify: `docs/modules/lib/renderer/index.md` — add `describeAgentStep`
- Modify: `docs/modules/stores/index.md` — note `latestEventForTask` on `sprintEvents` row
- Modify: `docs/modules/services/index.md` — note quality write-back on `review-service` row

- [ ] **Step 1: Update renderer lib index**

In `docs/modules/lib/renderer/index.md`, add a row for `describeAgentStep.ts`:

| Module | Purpose |
|---|---|
| `describeAgentStep.ts` | Pure fn: converts `AgentEvent \| undefined` → human-readable step string for `ActiveAgentsCard` |

- [ ] **Step 2: Update stores index**

In `docs/modules/stores/index.md`, update the `sprintEvents.ts` row to note the new export:

Add `latestEventForTask(taskEvents, taskId)` to the description: pure ring-buffer lookup for use outside hooks.

- [ ] **Step 3: Update services index**

In `docs/modules/services/index.md`, update the `review-service.ts` row to note that it now writes `quality_score` back to `sprint_tasks` after a successful structured review.

- [ ] **Step 4: Run final full suite**

```bash
npm run typecheck && npm test && npm run lint
```

Expected: zero errors, all tests pass, zero lint errors

- [ ] **Step 5: Commit docs**

```bash
git add docs/modules/
git commit -m "docs: update module docs for Phase 2.5 — describeAgentStep, latestEventForTask, review write-back"
```
