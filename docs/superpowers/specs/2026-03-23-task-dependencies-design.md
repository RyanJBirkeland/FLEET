# Task Dependency System — Design Spec

**Date:** 2026-03-23
**Status:** Draft

## Problem

BDE's AgentManager drain loop claims any queued task with available slots — there is no concept of ordering or prerequisite relationships between tasks. This means pipeline chains (A before B), fan-out/fan-in patterns, and soft ordering hints are all impossible. The field mapper already maps `dependsOn` ↔ `depends_on`, but nothing else in the system supports dependencies.

## Requirements

1. **Pipeline chains** — Task B runs only after Task A completes (e.g., "build API" → "build UI that calls API")
2. **Fan-out / fan-in** — Multiple tasks run in parallel, then a final task runs when all are done
3. **Soft ordering** — Advisory "prefer to run after X" without hard blocking
4. **Configurable failure behavior** — Per-edge `hard` (block dependents on failure) or `soft` (unblock anyway) with default = block
5. **Cross-sprint dependencies** — Any task can depend on any other task regardless of sprint
6. **Lightweight UI** — Show dependency info on task cards; set dependencies during task create/edit
7. **Cycle detection** — Prevent deadlocks at creation time

## Non-Goals

- Visual graph editor / drag-to-link UI (future)
- Automatic dependency inference from task content
- Conditional dependencies (run B only if A produces output X)

## Design

### Data Model

#### New type: `TaskDependency`

```typescript
// src/shared/types.ts
interface TaskDependency {
  id: string          // task ID this depends on
  type: 'hard' | 'soft'  // hard = block on fail, soft = unblock regardless
}
```

#### Updated `SprintTask` interface

```typescript
// Added field
depends_on: TaskDependency[] | null
```

When `depends_on` is `null` or `[]`, the task has no dependencies.

#### New task status: `blocked`

```typescript
status: 'backlog' | 'queued' | 'blocked' | 'active' | 'done' | 'cancelled' | 'failed' | 'error'
```

`blocked` means "this task has unsatisfied hard dependencies." The drain loop ignores `blocked` tasks. When all dependencies resolve, the system automatically transitions `blocked → queued`.

#### Supabase schema

Single column addition to `sprint_tasks`:

```sql
ALTER TABLE sprint_tasks ADD COLUMN depends_on JSONB DEFAULT NULL;
```

No new tables. The JSONB column stores `TaskDependency[]`.

#### Field mapper

Already maps `dependsOn` ↔ `depends_on` — no change needed (`src/main/queue-api/field-mapper.ts:5`).

#### Update allowlist

Add `depends_on` to `UPDATE_ALLOWLIST` in `src/main/data/sprint-queries.ts:10`.

### Reverse Index

An in-memory `Map<string, Set<string>>` mapping `dependencyTaskId → Set<dependentTaskIds>` maintained by the AgentManager. This enables O(1) lookup of "which tasks depend on this one?" when a task completes.

#### Lifecycle

1. **Built on startup** — query all tasks with non-null `depends_on`, populate the map
2. **Updated on task create/update** — when `depends_on` changes, update affected entries
3. **Pruned on task delete** — remove the task from all sets, remove its own entry

#### Implementation location

New module: `src/main/agent-manager/dependency-index.ts`

```typescript
export interface DependencyIndex {
  /** Rebuild from a full task list (startup) */
  rebuild(tasks: Array<{ id: string; depends_on: TaskDependency[] | null }>): void

  /** Update when a task's depends_on changes */
  update(taskId: string, oldDeps: TaskDependency[] | null, newDeps: TaskDependency[] | null): void

  /** Remove a task entirely (deleted) */
  remove(taskId: string): void

  /** Get all task IDs that directly depend on the given task */
  getDependents(taskId: string): Set<string>

  /** Check if all dependencies of a task are satisfied */
  areDependenciesSatisfied(
    taskId: string,
    deps: TaskDependency[],
    getTaskStatus: (id: string) => string | undefined
  ): { satisfied: boolean; blockedBy: string[] }
}
```

### Status Transitions

#### New transitions involving `blocked`

```
Task created with depends_on (unsatisfied hard deps)
  → status = 'blocked'

Task created with depends_on (all deps already satisfied)
  → status = 'queued' (or 'backlog' if user hasn't queued it)

Dependency task completes (done/cancelled/failed):
  For each dependent task (from reverse index):
    If dependent.status === 'blocked':
      If dependency.type === 'hard' AND dependency.status === 'failed':
        → dependent stays 'blocked' (manual intervention required)
      If dependency.type === 'soft' AND dependency.status === 'failed':
        → treat as satisfied, re-evaluate all deps
      If all remaining hard deps satisfied:
        → dependent transitions 'blocked' → 'queued'
```

#### Manual unblock

Users can manually transition a `blocked` task to `queued` via the UI — this overrides dependency checks (escape hatch for when a failed dependency doesn't actually matter).

#### Queuing a task with dependencies

When a user moves a task from `backlog` → `queued`:
- If the task has unsatisfied hard dependencies, transition to `blocked` instead of `queued`
- Show a toast: "Task blocked — waiting on N dependencies"

### Drain Loop Changes

**File:** `src/main/agent-manager/index.ts` (lines 273–350)

The drain loop currently calls `fetchQueuedTasks(available)` which returns only `status='queued'` tasks. Since `blocked` is a separate status, **no filtering changes are needed in the drain loop itself** — blocked tasks are never returned by `getQueuedTasks()`.

The dependency logic lives in the **status transition layer**, not the drain loop. This keeps the drain loop simple and fast.

### Completion Handler Changes

**File:** `src/main/agent-manager/completion.ts`

After a task reaches a terminal status (`done`, `failed`, `cancelled`, `error`), a new `resolveDependents()` function runs:

```typescript
export async function resolveDependents(
  completedTaskId: string,
  completedStatus: string,
  index: DependencyIndex,
  getTask: (id: string) => Promise<SprintTask | null>,
  updateTask: (id: string, patch: Record<string, unknown>) => Promise<unknown>
): Promise<void>
```

Logic:
1. Look up `index.getDependents(completedTaskId)`
2. For each dependent task:
   a. Skip if dependent is not `blocked`
   b. Fetch the dependent's full `depends_on` array
   c. For each dependency in the array:
      - If the dependency points to `completedTaskId` and type is `hard` and `completedStatus` is `failed` → this dep is unsatisfied, stop checking
      - If the dependency points to a different task → check that task's current status
      - Soft deps with failed status count as satisfied
      - Hard deps need `done` or `cancelled` to be satisfied
   d. If all dependencies satisfied → `updateTask(dependent.id, { status: 'queued' })`

### Cycle Detection

**File:** New utility in `src/main/agent-manager/dependency-index.ts`

```typescript
export function detectCycle(
  taskId: string,
  proposedDeps: TaskDependency[],
  getDepsForTask: (id: string) => TaskDependency[] | null
): string[] | null  // returns cycle path or null
```

Uses depth-first traversal from each proposed dependency, following their `depends_on` chains. If `taskId` is found in any chain, returns the cycle path for error reporting.

Called:
- When creating a task with `depends_on`
- When updating a task's `depends_on`
- Returns an error to the caller (API 400 or UI validation error) with the cycle path

### Queue API Changes

**File:** `src/main/queue-api/router.ts`

#### POST /queue/tasks (create)

- Accept optional `dependsOn` field in request body
- Run cycle detection before insert
- If task has unsatisfied hard dependencies and status would be `queued`, set `blocked` instead

#### PATCH /queue/tasks/:id (update)

- Allow `depends_on` in the update patch (added to `UPDATE_ALLOWLIST`)
- Run cycle detection on dependency changes
- Re-evaluate blocked/queued status after dependency change

#### GET /queue/tasks/:id (read)

- Include `dependsOn` in response (already mapped by field mapper)

#### GET /queue/health

- Add `blocked` count to `QueueStats`

### Sprint Queries Changes

**File:** `src/main/data/sprint-queries.ts`

#### `getBlockedTasks()`

New function to fetch all blocked tasks (for startup index rebuild and UI):

```typescript
export async function getBlockedTasks(): Promise<SprintTask[]> {
  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks').select('*')
    .eq('status', 'blocked')
  if (error) throw error
  return data ?? []
}
```

#### `getTasksWithDependencies()`

New function for reverse index rebuild on startup:

```typescript
export async function getTasksWithDependencies(): Promise<
  Array<{ id: string; depends_on: TaskDependency[] | null; status: string }>
> {
  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .select('id, depends_on, status')
    .not('depends_on', 'is', null)
  if (error) throw error
  return data ?? []
}
```

#### `QueueStats`

Add `blocked: number` field.

### UI Changes

#### Task Card (`src/renderer/src/components/sprint/TaskCard.tsx`)

- Show a `blocked` badge when `task.status === 'blocked'`
- Below the task title, show dependency chips: "Depends on: Task A (hard), Task B (soft)"
- Failed hard dependencies shown in red; satisfied dependencies shown in green/muted
- Add "Unblock" button on blocked cards (manual override → transitions to `queued`)

#### Task Create/Edit Form

- Add a "Dependencies" field — multi-select dropdown of existing tasks
- Each selected dependency gets a `hard`/`soft` toggle (default: `hard`)
- Show cycle detection errors inline if the user creates a circular dependency

#### Sprint Kanban

- Add `blocked` as a visible column/group between `backlog` and `queued`
- Or render blocked tasks within the `queued` column with a visual "blocked" overlay — whichever fits the current kanban layout better (implementation decision)

### IPC Changes

New handlers registered in `src/main/index.ts`:

```typescript
// Validate dependencies (cycle detection) before save
'sprint:validate-dependencies' → (taskId, proposedDeps) → { valid: boolean; cycle?: string[] }

// Manual unblock
'sprint:unblock-task' → (taskId) → SprintTask
```

### Testing Strategy

#### Unit tests

- **`dependency-index.test.ts`** — rebuild, update, remove, getDependents, areDependenciesSatisfied
- **`cycle-detection.test.ts`** — no cycle, self-cycle, A→B→A, A→B→C→A, diamond (not a cycle), deep chain
- **`completion.test.ts`** — extend existing tests for `resolveDependents`: hard dep done → unblock, hard dep failed → stay blocked, soft dep failed → unblock, mixed deps, no dependents (no-op)

#### Integration tests

- **Drain loop skips blocked tasks** — create task with unmet dep, verify drain loop doesn't claim it
- **End-to-end pipeline** — Task A (queued) → completes → Task B (blocked → queued) → claimed
- **Fan-in** — Tasks A+B parallel → Task C blocked on both → A done → C still blocked → B done → C queued
- **Soft dependency failure** — Task A fails → Task B (soft dep on A) → unblocked
- **Hard dependency failure** — Task A fails → Task B (hard dep on A) → stays blocked
- **Manual unblock** — Task blocked → user clicks unblock → task queued

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Dependency target doesn't exist | Reject at creation time (API 400: "Task {id} not found") |
| Dependency target deleted after creation | Treat as satisfied (the work is gone, don't block forever) |
| Cycle detected | Reject at creation/update time (API 400 with cycle path) |
| Reverse index out of sync | Rebuild on next startup; log warning |
| Supabase unavailable during `resolveDependents` | Log error; blocked tasks stay blocked until next completion event or startup rebuild |

### Migration Path

1. Add `depends_on` JSONB column to Supabase `sprint_tasks` table (default NULL)
2. Add `blocked` to the status enum/check constraint if one exists
3. All existing tasks have `depends_on = NULL` — no migration of existing data needed
4. Deploy backend changes first (drain loop already ignores non-queued tasks)
5. Deploy UI changes (dependency display and editing)
