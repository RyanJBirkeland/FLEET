# Dependency System Hardening — Implementation Specs

Six task specs for hardening the BDE dependency/blocking system. Each is self-contained and implementation-ready.

---

## Task 1 (P0): Sanitize depends_on in main process

### Problem
Supabase stores `depends_on` as JSONB. When retrieved, it can arrive as a raw JSON **string** (e.g., `"[{\"id\":\"abc\",\"type\":\"hard\"}]"`) instead of a parsed array. Any code calling `.map()`, `.length`, or iterating with `for...of` on this value will crash with `TypeError: task.depends_on.map is not a function`.

### Root cause
No sanitization layer exists between Supabase responses and consumption sites. The following files iterate `depends_on` unsafely:

- `/Users/ryan/projects/BDE/src/main/agent-manager/resolve-dependents.ts` line 30: `task.depends_on.length` and line 37: `for (const dep of task.depends_on)`
- `/Users/ryan/projects/BDE/src/main/handlers/sprint-local.ts` line 113: `taskDeps.length` and line 120: `idx.areDependenciesSatisfied(id, taskDeps, ...)`
- `/Users/ryan/projects/BDE/src/main/agent-manager/dependency-index.ts` line 21: `for (const dep of deps)` in `addEdges`

### Solution

1. **Create a shared utility** in `src/shared/parse-depends-on.ts`:

```typescript
import type { TaskDependency } from './types'

/**
 * Safely parse depends_on from Supabase JSONB.
 * Handles: null, undefined, valid array, JSON string, garbage.
 */
export function parseDependsOn(raw: unknown): TaskDependency[] | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw as TaskDependency[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as TaskDependency[]
    } catch {
      // fall through
    }
  }
  return null
}
```

2. **Apply at the data layer** in `src/main/data/sprint-queries.ts` — add a row-level sanitizer applied after every query:

```typescript
import { parseDependsOn } from '../../shared/parse-depends-on'

function sanitizeTask(row: SprintTask): SprintTask {
  return { ...row, depends_on: parseDependsOn(row.depends_on) }
}
```

Apply `sanitizeTask` to the return values of `getTask()` (line 55), `listTasks()` (line 74), and `createTask()`.

3. **Add defensive guards** at consumption sites as a safety net — in `resolve-dependents.ts` line 30, wrap:

```typescript
const deps = Array.isArray(task.depends_on) ? task.depends_on : []
if (deps.length === 0) continue
```

### Files to modify
- `src/shared/parse-depends-on.ts` — **new file**, ~20 lines
- `src/main/data/sprint-queries.ts` — add import + `sanitizeTask()` wrapper on `getTask`, `listTasks`, `createTask` returns
- `src/main/agent-manager/resolve-dependents.ts` — defensive `Array.isArray` check on line 30
- `src/main/agent-manager/dependency-index.ts` — defensive check in `addEdges` (line 19-20)

### Test requirements
- Unit test `src/shared/__tests__/parse-depends-on.test.ts`: test null, valid array, JSON string, malformed string, number, nested object
- Update existing `resolve-dependents` tests to include a case where `depends_on` is a JSON string

### Edge cases
- `depends_on` could be an empty string `""` — should return `null`
- `depends_on` could be `"null"` (string literal) — `JSON.parse("null")` returns `null`, not an array; handle correctly
- Double-encoded JSON (string of a string) — treat as garbage, return `null`

### Verification
- Write a test that passes `'[{"id":"x","type":"hard"}]'` (string) to `parseDependsOn` and confirms it returns a valid array
- Run `npm test` — all existing tests pass
- Run `npm run typecheck` — no type errors

---

## Task 2 (P0): Add Blocked section to Sprint Center Kanban

### Problem
When a task's status is set to `blocked`, `partitionSprintTasks()` puts it into the `todo` bucket (line 41-42 of `partitionSprintTasks.ts`). The KanbanBoard's "To Do" column renders blocked tasks mixed in with queued tasks, with no visual distinction. Users cannot see which tasks are blocked or why.

### Root cause
`partitionSprintTasks.ts` line 41-42 lumps `blocked` into `todo`:
```typescript
case TASK_STATUS.BLOCKED:
  todo.push(task)
  break
```

The `KanbanBoard` component receives `todoTasks` as a flat array and has no blocked-specific rendering. The `SprintPartition` interface has no `blocked` field.

### Solution

1. **Add `blocked` bucket to `SprintPartition`** in `src/renderer/src/lib/partitionSprintTasks.ts`:

```typescript
export interface SprintPartition {
  backlog: SprintTask[]
  blocked: SprintTask[]  // NEW
  todo: SprintTask[]
  inProgress: SprintTask[]
  awaitingReview: SprintTask[]
  done: SprintTask[]
  failed: SprintTask[]
}
```

Update the partition function:
```typescript
case TASK_STATUS.BLOCKED:
  blocked.push(task)  // was: todo.push(task)
  break
```

2. **Add `blockedTasks` prop to `KanbanBoard`** in `src/renderer/src/components/sprint/KanbanBoard.tsx`:

Add to the props type:
```typescript
blockedTasks: SprintTask[]
```

Add a new `KanbanColumn` between "To Do" and "In Progress":
```tsx
<KanbanColumn
  status="blocked"
  label="Blocked"
  tasks={blockedTasks}
  prMergedMap={prMergedMap}
  generatingIds={generatingIds}
  readOnly
  onPushToSprint={onPushToSprint}
  onLaunch={onLaunch}
  onViewSpec={onViewSpec}
  onViewOutput={onViewOutput}
  onMarkDone={onMarkDone}
  onStop={onStop}
/>
```

Mark it `readOnly` so users cannot drag tasks into/out of the blocked column (status is managed by the dependency system).

3. **Pass blocked tasks from SprintCenter** in `SprintCenter.tsx` line ~277:

```tsx
<KanbanBoard
  blockedTasks={partition.blocked}
  todoTasks={partition.todo}
  ...
```

4. **Show blocker info on TaskCard** — when `task.status === 'blocked'` and `task.depends_on` is non-empty, render a small line below the title showing blocked dependency IDs. This can be a simple `<span className="task-card__blocked-info">` with the dep IDs truncated.

### Files to modify
- `src/renderer/src/lib/partitionSprintTasks.ts` — add `blocked` bucket, change BLOCKED case
- `src/renderer/src/components/sprint/KanbanBoard.tsx` — add `blockedTasks` prop, render blocked column
- `src/renderer/src/components/sprint/SprintCenter.tsx` — pass `partition.blocked` to KanbanBoard
- `src/renderer/src/lib/__tests__/partitionSprintTasks.test.ts` — update expected partition shape

### Test requirements
- Update `partitionSprintTasks.test.ts`: blocked tasks land in `blocked` bucket, not `todo`
- Add test: blocked task with `depends_on` is in `blocked`, queued task without deps is in `todo`

### Edge cases
- Task is `blocked` but has empty `depends_on` (manually blocked) — still shows in Blocked column
- Blocked column should not be a drag target — `readOnly` prop handles this
- Column count changes from 3 to 4 — verify CSS grid/flex layout accommodates it

### Verification
- Manually create a task with `status: 'blocked'` — confirm it appears in the Blocked column, not To Do
- Confirm drag-and-drop still works for To Do and In Progress columns
- `npm test` passes with updated partition tests

---

## Task 3 (P1): Validate depends_on at Queue API creation

### Problem
`handleCreateTask` in `src/main/queue-api/task-handlers.ts` (line 58-87) accepts any `depends_on` array without validation. Callers can reference non-existent task IDs or create circular dependency chains. These invalid states cause silent failures when the drain loop tries to resolve dependencies.

### Root cause
`handleCreateTask` passes the body directly to `createTask()` on line 85:
```typescript
const task = await createTask(body as Parameters<typeof createTask>[0])
```

No existence check, no cycle detection. The IPC handler `sprint:validateDependencies` in `sprint-local.ts` (line 186-220) already does this validation, but the Queue API bypasses it entirely.

### Solution

1. **Extract validation into a shared function** in `src/main/agent-manager/validate-dependencies.ts`:

```typescript
import { detectCycle } from './dependency-index'
import type { TaskDependency } from '../../shared/types'
import type { SprintTask } from '../../shared/types'

export interface ValidateDepsResult {
  valid: boolean
  error?: string
  cycle?: string[]
}

export async function validateDependencies(
  taskId: string,
  proposedDeps: TaskDependency[],
  getTask: (id: string) => Promise<Pick<SprintTask, 'id' | 'depends_on'> | null>,
  listTasks: () => Promise<Pick<SprintTask, 'id' | 'depends_on'>[]>,
): Promise<ValidateDepsResult> {
  // 1. Check all targets exist
  for (const dep of proposedDeps) {
    const target = await getTask(dep.id)
    if (!target) return { valid: false, error: `Task ${dep.id} not found` }
  }

  // 2. Check for cycles
  const allTasks = await listTasks()
  const depsMap = new Map(allTasks.map((t) => [t.id, t.depends_on]))
  const cycle = detectCycle(taskId, proposedDeps, (id) => depsMap.get(id) ?? null)
  if (cycle) return { valid: false, error: `Circular dependency detected`, cycle }

  return { valid: true }
}
```

2. **Use in `handleCreateTask`** — after body parsing, before `createTask()`:

```typescript
const { depends_on } = body as Record<string, unknown>
if (depends_on && Array.isArray(depends_on) && depends_on.length > 0) {
  // Generate a temporary ID for cycle detection (task doesn't exist yet)
  const tempId = crypto.randomUUID()
  const result = await validateDependencies(tempId, depends_on, getTask, listTasks)
  if (!result.valid) {
    sendJson(res, 400, { error: result.error, cycle: result.cycle })
    return
  }
}
```

3. **Also validate on PATCH** — add the same check to `handleUpdateTask` when `depends_on` is in the patch body.

4. **Refactor `sprint:validateDependencies` IPC handler** in `sprint-local.ts` to use the shared function.

### Files to modify
- `src/main/agent-manager/validate-dependencies.ts` — **new file**, shared validation logic
- `src/main/queue-api/task-handlers.ts` — add validation in `handleCreateTask` and `handleUpdateTask`
- `src/main/handlers/sprint-local.ts` — refactor `sprint:validateDependencies` to use shared function

### Test requirements
- Unit test `validate-dependencies.test.ts`: non-existent ID returns error, cycle returns error with path, valid deps return `{ valid: true }`
- Integration test for Queue API: POST with non-existent dep ID returns 400, POST with cycle returns 400 with cycle path

### Edge cases
- `depends_on` is present but empty array — skip validation, allow creation
- `depends_on` is `null` — skip validation
- Task depends on itself — `detectCycle` already catches this (line 62: `if (dep.id === taskId) return [taskId, taskId]`)
- For new tasks, cycle detection uses a temp ID — ensure the temp ID doesn't collide with existing tasks (UUID collision is astronomically unlikely)

### Verification
- `curl -X POST /queue/tasks` with `depends_on: [{id: "nonexistent", type: "hard"}]` returns 400
- `curl -X POST /queue/tasks` with valid deps succeeds with 201
- `npm run test:main` passes

---

## Task 4 (P1): Record blocked reason in task notes

### Problem
When the dependency system auto-blocks a task (in `sprint-local.ts` line 126: `patch = { ...patch, status: 'blocked' }`), no explanation is recorded. The user sees a task in `blocked` status with no indication of which dependencies are unsatisfied. The `notes` field remains unchanged.

### Root cause
The blocking logic in `sprint-local.ts` line 125-127 only overrides the status:
```typescript
if (!satisfied) {
  patch = { ...patch, status: 'blocked' }
}
```

No note is written. Similarly, when `resolveDependents` in `resolve-dependents.ts` unblocks a task (line 51), it only sets `status: 'queued'` — it doesn't clear any blocking note.

### Solution

1. **Record blocker info when blocking** in `sprint-local.ts`. The `areDependenciesSatisfied` call already returns `blockedBy` (line 120-123). Use it:

```typescript
const { satisfied, blockedBy } = idx.areDependenciesSatisfied(
  id,
  taskDeps,
  (depId) => statusMap.get(depId),
)
if (!satisfied) {
  const blockerNote = `[auto-blocked] Waiting on: ${blockedBy.join(', ')}`
  patch = { ...patch, status: 'blocked', notes: blockerNote }
}
```

2. **Clear blocking note when unblocking** in `resolve-dependents.ts` line 51:

```typescript
if (satisfied) {
  await updateTask(depId, { status: 'queued', notes: null })
}
```

Note: setting `notes: null` clears the auto-blocked note. If the task had user-written notes before being blocked, those would be lost. To preserve them, prefix auto-block notes with `[auto-blocked]` and only clear notes that start with that prefix:

```typescript
if (satisfied) {
  const existingNotes = task.notes ?? ''  // need to fetch notes in getTask
  const clearedNotes = existingNotes.startsWith('[auto-blocked]') ? null : existingNotes
  await updateTask(depId, { status: 'queued', notes: clearedNotes })
}
```

This requires the `getTask` signature in `resolveDependents` to also return `notes`. Update the type on line 17-19:

```typescript
getTask: (id: string) => Promise<(Pick<SprintTask, 'id' | 'status' | 'notes'> & {
  depends_on: TaskDependency[] | null
}) | null>,
```

3. **Also record blocker in drain loop blocking** — check if the drain loop in `agent-manager/index.ts` also blocks tasks, and apply the same note pattern there.

### Files to modify
- `src/main/handlers/sprint-local.ts` — add `notes: blockerNote` to blocked patch (around line 126)
- `src/main/agent-manager/resolve-dependents.ts` — clear auto-block notes on unblock, update `getTask` type to include `notes`
- `src/main/agent-manager/index.ts` — update `getTask` call if needed to include `notes` field

### Test requirements
- Test in `sprint-local` handler tests: when task is blocked, notes contain the blocker IDs
- Test in `resolve-dependents` tests: after unblocking, auto-blocked notes are cleared; user notes are preserved

### Edge cases
- Task has user-written notes AND gets auto-blocked — prepend `[auto-blocked]` line, preserve original notes on a new line
- Multiple blockers — list all IDs in the note
- Blocker IDs are UUIDs — long notes are acceptable, no truncation needed
- `notes` field size limit in Supabase — text type, no practical limit

### Verification
- Create task A (queued) and task B (depends on A, hard). B should have notes: `[auto-blocked] Waiting on: <A's ID>`
- Complete task A. B transitions to queued, notes are cleared
- `npm test` passes

---

## Task 5 (P2): Idempotent PR creation in completion handler

### Problem
`resolveSuccess()` in `src/main/agent-manager/completion.ts` (line 30-98) always runs `gh pr create` without checking if a PR already exists for the branch. If the agent process exits and the task is retried (or the completion handler runs twice due to race conditions), a duplicate PR is created or `gh pr create` fails with "a pull request already exists".

### Root cause
`resolveSuccess` at line 74-86 calls `gh pr create` unconditionally:
```typescript
const { stdout: prOut } = await execFile(
  'gh',
  ['pr', 'create', '--title', title, '--body', 'Automated by BDE', '--head', branch, '--repo', ghRepo],
  { cwd: worktreePath, env: buildAgentEnv() }
)
```

No check for an existing PR on the branch. The `catch` on line 83 silently swallows the error, leaving the task without PR info even though a PR exists.

### Solution

1. **Check for existing PR before creating** — add a lookup step between push (line 62-69) and create (line 74):

```typescript
// 2.5. Check if PR already exists for this branch
let existingPrUrl: string | null = null
let existingPrNumber: number | null = null
try {
  const { stdout: viewOut } = await execFile(
    'gh',
    ['pr', 'view', branch, '--repo', ghRepo, '--json', 'url,number'],
    { cwd: worktreePath, env: buildAgentEnv() }
  )
  const parsed = JSON.parse(viewOut.trim())
  if (parsed.url && parsed.number) {
    existingPrUrl = parsed.url
    existingPrNumber = parsed.number
    logger.info(`[completion] PR already exists for branch ${branch}: ${existingPrUrl}`)
  }
} catch {
  // No existing PR — proceed to create
}

if (existingPrUrl && existingPrNumber) {
  // PR already exists — just update the task record
  await updateTask(taskId, { pr_status: 'open', pr_url: existingPrUrl, pr_number: existingPrNumber })
  return
}
```

2. **Update the task status in the catch block** — if `gh pr create` fails with "already exists", parse the error for the PR URL:

```typescript
} catch (err) {
  const errStr = String(err)
  // gh prints the existing PR URL in the error message
  const existingMatch = errStr.match(/https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/)
  if (existingMatch) {
    prUrl = existingMatch[0]
    prNumber = parseInt(existingMatch[1], 10)
    logger.info(`[completion] Used existing PR for task ${taskId}: ${prUrl}`)
  } else {
    logger.warn(`[completion] gh pr create failed for task ${taskId}: ${err}`)
  }
}
```

### Files to modify
- `src/main/agent-manager/completion.ts` — add `gh pr view` check before `gh pr create` (between lines 69 and 71)

### Test requirements
- Unit test: mock `execFile` to simulate `gh pr view` returning existing PR — verify `gh pr create` is NOT called
- Unit test: mock `gh pr view` throwing (no PR) — verify `gh pr create` IS called
- Unit test: mock `gh pr create` throwing with "already exists" message containing URL — verify PR info is extracted

### Edge cases
- Branch has PR in a different repo (fork) — `--repo ghRepo` scopes the lookup correctly
- PR was closed (not merged) — `gh pr view` still returns it; this is acceptable since the branch was just pushed with new commits
- Rate limiting on `gh` CLI — the additional API call is one extra per completion, negligible impact
- `gh pr view` output format changes — use `--json` flag for stable output

### Verification
- Run an agent task to completion, let it create a PR. Re-run the same task (or manually call `resolveSuccess` with the same branch). Verify no duplicate PR is created.
- Check task record has correct `pr_url` and `pr_number` in both first-run and re-run cases
- `npm run test:main` passes

---

## Task 6 (P2): resolveDependents after fast-fail exhaustion

### Problem
When a task's `fast_fail_count` reaches 3 (exhausted), `run-agent.ts` line 184-187 sets the task to `error` and calls `onTaskTerminal`:

```typescript
if (ffResult === 'fast-fail-exhausted') {
  await updateTask(task.id, { status: 'error', completed_at: now, notes: 'Fast-fail exhausted' })
    .catch(...)
  await onTaskTerminal(task.id, 'error')
}
```

This path correctly calls `onTaskTerminal(task.id, 'error')`. However, verify that:
1. The `error` status is properly handled by `areDependenciesSatisfied` — it should unblock `soft` deps (since `error` is in `TERMINAL_STATUSES`) but keep `hard` deps blocked (since `error` is NOT in `HARD_SATISFIED_STATUSES`).
2. The `.catch()` on the `updateTask` call (line 185-186) does not prevent `onTaskTerminal` from running. Currently these are sequential `await` calls, so if `updateTask` throws and is caught, execution continues to `onTaskTerminal`. But the `.catch()` on `updateTask` swallows the error — `onTaskTerminal` is called regardless. This is correct.

The real risk is in `resolveFailure` (completion.ts line 101-120). When `retryCount >= MAX_RETRIES`, the task is set to `failed`:

```typescript
await updateTask(taskId, {
  status: 'failed',
  completed_at: new Date().toISOString(),
})
```

But **no `onTaskTerminal` is called from `resolveFailure`**. The caller in `run-agent.ts` line 207-210 does call it:

```typescript
await resolveFailure({ taskId: task.id, retryCount: task.retry_count ?? 0 }, logger)
if ((task.retry_count ?? 0) >= MAX_RETRIES) {
  await onTaskTerminal(task.id, 'failed')
}
```

However, this uses the **stale** `task.retry_count` from the task object at spawn time, while `resolveFailure` uses `retryCount` (same value). If `retry_count` was updated externally between spawn and completion, the condition could be wrong. This is an unlikely but real race.

### Root cause
The `onTaskTerminal` guard in `run-agent.ts` line 208 duplicates the retry exhaustion check from `resolveFailure` but uses a potentially stale value:

```typescript
if ((task.retry_count ?? 0) >= MAX_RETRIES) {
  await onTaskTerminal(task.id, 'failed')
}
```

### Solution

1. **Make `resolveFailure` return whether the task reached terminal status** so the caller doesn't need to re-check:

```typescript
export async function resolveFailure(opts: ResolveFailureOpts, logger?: Logger): Promise<boolean> {
  const { taskId, retryCount } = opts
  try {
    if (retryCount < MAX_RETRIES) {
      await updateTask(taskId, {
        status: 'queued',
        retry_count: retryCount + 1,
        claimed_by: null,
      })
      return false  // not terminal
    } else {
      await updateTask(taskId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      return true  // terminal
    }
  } catch (err) {
    logger?.error(`[completion] Failed to update task ${taskId} during failure resolution: ${err}`)
    return false
  }
}
```

2. **Update caller in `run-agent.ts`** (line 206-210):

```typescript
const isTerminal = await resolveFailure({ taskId: task.id, retryCount: task.retry_count ?? 0 }, logger)
if (isTerminal) {
  await onTaskTerminal(task.id, 'failed')
}
```

This eliminates the duplicated check and ensures `onTaskTerminal` is called exactly when `resolveFailure` actually transitions to `failed`.

3. **Add test coverage** to confirm `onTaskTerminal` fires for all terminal paths:
   - fast-fail-exhausted (line 184-187) — already calls `onTaskTerminal`
   - resolveSuccess error with task set to `error` (line 44, 52) — does NOT call `onTaskTerminal`. **Fix**: add `await onTaskTerminal(task.id, 'error')` after the early returns in resolveSuccess that set status to `error`.

The lines in `completion.ts` that set `error` without triggering `onTaskTerminal`:
   - Line 44: `await updateTask(taskId, { status: 'error', ... })` then `return` — dependents never notified
   - Line 52: same pattern

**Fix in `run-agent.ts`** — the `resolveSuccess` call is wrapped in a try/catch (line 196-211). When `resolveSuccess` throws, `resolveFailure` is called. But when `resolveSuccess` sets `error` and returns normally (no throw), the caller doesn't know the task is terminal. Fix by having `resolveSuccess` return a result indicating terminal status, or by calling `onTaskTerminal` inside `resolveSuccess` (requires passing it as a dependency).

Simpler approach: **pass `onTaskTerminal` to `resolveSuccess`**:

```typescript
// In resolveSuccess, after setting status to 'error':
await onTaskTerminal(taskId, 'error')
return
```

Update `ResolveSuccessOpts`:
```typescript
export interface ResolveSuccessOpts {
  taskId: string
  worktreePath: string
  title: string
  ghRepo: string
  onTaskTerminal: (taskId: string, status: string) => Promise<void>
}
```

### Files to modify
- `src/main/agent-manager/completion.ts` — change `resolveFailure` return type to `boolean`, add `onTaskTerminal` to `ResolveSuccessOpts`, call it on error early-returns
- `src/main/agent-manager/run-agent.ts` — use `resolveFailure` return value, pass `onTaskTerminal` to `resolveSuccess`

### Test requirements
- Test: task with `retry_count === MAX_RETRIES - 1` fails -> `resolveFailure` returns `true`, `onTaskTerminal` called with `'failed'`
- Test: task with `retry_count === 0` fails -> `resolveFailure` returns `false`, `onTaskTerminal` NOT called
- Test: `resolveSuccess` branch detection fails -> `onTaskTerminal` called with `'error'`
- Test: fast-fail exhausted -> `onTaskTerminal` called with `'error'` (existing behavior, add explicit test)

### Edge cases
- `resolveFailure` throws during `updateTask` — returns `false`, `onTaskTerminal` is not called; the task is stuck. This is acceptable because the DB write failed, so the status didn't actually change.
- `onTaskTerminal` itself throws — already wrapped in try/catch in `agent-manager/index.ts` line 117-123
- Multiple concurrent completions for the same task (race) — `activeAgents.delete` on line 165 prevents double-processing

### Verification
- Create task A (queued). Create task B (depends on A, soft dep). Force A to fast-fail 3 times. Verify B transitions from `blocked` to `queued`.
- Create the same scenario but with A failing via `resolveFailure` after MAX_RETRIES. Verify B unblocks.
- `npm run test:main` passes
