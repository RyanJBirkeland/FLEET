# PR Builder & Code-Approved Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `approved` task status, dependency unblocking at approval time, and a persistent PR Builder modal that replaces the rough Rollup PR flow.

**Architecture:** Three independent but ordered phases: (1) state machine + backend services that can ship standalone, (2) PR Groups data layer + PR Builder modal, (3) agent manager fork-on-approve and auto-rebase. All phases build on the `approved` status added in Task 1.

**Tech Stack:** TypeScript, Electron (main + renderer), SQLite (better-sqlite3), Zustand, React, Vitest, IPC via typed channels in `src/shared/ipc-channels/`.

---

## File Map

### Create
| File | Purpose |
|------|---------|
| `src/main/migrations/v059-add-approved-status-and-pr-groups.ts` | DB schema: `stacked_on_task_id` column + `pr_groups` table |
| `src/main/data/pr-group-queries.ts` | CRUD for `pr_groups` table |
| `src/main/handlers/pr-groups.ts` | IPC handler — thin wrapper for prGroups:* channels |
| `src/main/services/pr-group-build-service.ts` | Git ops + PR creation per group (replaces `ReviewRollupService`) |
| `src/renderer/src/stores/prGroups.ts` | Zustand store for PR group state |
| `src/renderer/src/hooks/useApproveAction.ts` | Approve action with toast feedback |
| `src/renderer/src/hooks/usePrGroups.ts` | Group management actions |
| `src/renderer/src/components/code-review/PrBuilderModal.tsx` | Full-screen PR composer modal |

### Modify
| File | Change |
|------|--------|
| `src/shared/task-state-machine.ts` | Add `approved` to union, transitions, `HARD_SATISFIED_STATUSES`, new `DEPENDENCY_TRIGGER_STATUSES` export |
| `src/shared/task-statuses.ts` | Add `APPROVED` constant, `'approved'` BucketKey, `StatusMetadata` entry |
| `src/shared/types/task-types.ts` | Add `stacked_on_task_id` to `SprintTask`; add `PrGroup` interface |
| `src/shared/ipc-channels/sprint-channels.ts` | Add `review:approveTask` + `prGroups:*` channels |
| `src/main/data/sprint-task-types.ts` | Add `stacked_on_task_id` to `UPDATE_ALLOWLIST`; add `approved` to `QueueStats` |
| `src/main/lib/resolve-dependents.ts` | Use `DEPENDENCY_TRIGGER_STATUSES` guard; `approved` now triggers resolution |
| `src/main/sprint-pr-poller.ts` | Also poll tasks with `status = 'approved' AND pr_status = 'open'` |
| `src/main/handlers/review.ts` | Add `review:approveTask` handler |
| `src/main/index.ts` | Register `pr-groups.ts` handler |
| `src/preload/index.ts` | Add `review.approveTask` + `prGroups` API object |
| `src/renderer/src/lib/partitionSprintTasks.ts` | Add `approved` bucket to `SprintPartition` |
| `src/renderer/src/components/code-review/TopBar.tsx` | Add "Build PR" button in Approved section |
| `src/renderer/src/components/code-review/ReviewActionsBar.tsx` | Add "Approve" primary action |
| `src/main/agent-manager/worktree.ts` | Accept optional `baseBranch` in `SetupWorktreeOpts` |
| `src/main/agent-manager/success-pipeline.ts` | Auto-rebase stacked task before `review` transition |

### Delete (Task 20)
- `src/renderer/src/components/code-review/RollupPrModal.tsx`
- `src/main/services/review-rollup-service.ts`

---

## Phase 1 — State Machine Foundation

### Task 1: DB Migration v059

**Files:**
- Create: `src/main/migrations/v059-add-approved-status-and-pr-groups.ts`

- [ ] **Step 1: Verify latest migration version**

```bash
ls src/main/migrations/ | sort | tail -3
```
Expected: `v058-add-last-rendered-prompt-to-sprint-tasks.ts` is last. Confirm v059 is free.

- [ ] **Step 2: Write the migration**

```typescript
// src/main/migrations/v059-add-approved-status-and-pr-groups.ts
import type Database from 'better-sqlite3'

export const version = 59
export const description = 'Add stacked_on_task_id to sprint_tasks and create pr_groups table'

export const up = (db: Database.Database): void => {
  const addColumn = `ALTER TABLE sprint_tasks ADD COLUMN stacked_on_task_id TEXT`
  db.exec(addColumn)

  const createPrGroups = `
    CREATE TABLE IF NOT EXISTS pr_groups (
      id          TEXT PRIMARY KEY,
      repo        TEXT NOT NULL,
      title       TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'composing',
      task_order  TEXT NOT NULL DEFAULT '[]',
      pr_number   INTEGER,
      pr_url      TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )
  `
  db.exec(createPrGroups)
}
```

- [ ] **Step 3: Run migration smoke test**

```bash
npm run test:main -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|migration)"
```
Expected: migration tests pass (the aggregate runMigrations test will pick up v059 automatically).

- [ ] **Step 4: Commit**

```bash
git add src/main/migrations/v059-add-approved-status-and-pr-groups.ts
git commit -m "feat(data): migration v059 — stacked_on_task_id and pr_groups table"
```

---

### Task 2: State Machine — Add `approved` Status

**Files:**
- Modify: `src/shared/task-state-machine.ts`
- Modify: `src/shared/task-statuses.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/shared/__tests__/task-state-machine.test.ts — add to existing test file
import { isValidTransition, isHardSatisfied, DEPENDENCY_TRIGGER_STATUSES, TASK_STATUSES } from '../task-state-machine'

describe('approved status', () => {
  it('includes approved in TASK_STATUSES', () => {
    expect(TASK_STATUSES).toContain('approved')
  })

  it('allows review → approved transition', () => {
    expect(isValidTransition('review', 'approved')).toBe(true)
  })

  it('allows approved → done transition', () => {
    expect(isValidTransition('approved', 'done')).toBe(true)
  })

  it('allows approved → queued transition', () => {
    expect(isValidTransition('approved', 'queued')).toBe(true)
  })

  it('allows approved → cancelled transition', () => {
    expect(isValidTransition('approved', 'cancelled')).toBe(true)
  })

  it('allows approved → failed transition', () => {
    expect(isValidTransition('approved', 'failed')).toBe(true)
  })

  it('satisfies hard dependencies', () => {
    expect(isHardSatisfied('approved')).toBe(true)
  })

  it('is in DEPENDENCY_TRIGGER_STATUSES', () => {
    expect(DEPENDENCY_TRIGGER_STATUSES.has('approved')).toBe(true)
  })

  it('is not a terminal status', () => {
    const { isTerminal } = require('../task-state-machine')
    expect(isTerminal('approved')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose src/shared/__tests__/task-state-machine.test.ts
```
Expected: FAIL — `approved` not found in TASK_STATUSES.

- [ ] **Step 3: Update `task-state-machine.ts`**

In `src/shared/task-state-machine.ts`, make these changes:

**TaskStatus union** — add `'approved'`:
```typescript
export type TaskStatus =
  | 'backlog'
  | 'queued'
  | 'blocked'
  | 'active'
  | 'review'
  | 'approved'
  | 'done'
  | 'cancelled'
  | 'failed'
  | 'error'
```

**TASK_STATUSES** — add `'approved'` between `'review'` and `'done'`:
```typescript
export const TASK_STATUSES = [
  'backlog',
  'queued',
  'blocked',
  'active',
  'review',
  'approved',
  'done',
  'cancelled',
  'failed',
  'error'
] as const satisfies readonly TaskStatus[]
```

**HARD_SATISFIED_STATUSES** — add `'approved'`:
```typescript
export const HARD_SATISFIED_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>(['done', 'approved'])
```

**VALID_TRANSITIONS** — add `'approved'` to `review`'s allowed set, add new `approved` entry:
```typescript
export const VALID_TRANSITIONS: Record<TaskStatus, ReadonlySet<TaskStatus>> = {
  backlog: new Set<TaskStatus>(['queued', 'blocked', 'cancelled']),
  queued: new Set<TaskStatus>(['active', 'blocked', 'backlog', 'cancelled', 'done', 'failed', 'error']),
  blocked: new Set<TaskStatus>(['queued', 'cancelled']),
  active: new Set<TaskStatus>(['review', 'done', 'failed', 'error', 'cancelled', 'queued']),
  review: new Set<TaskStatus>(['queued', 'done', 'cancelled', 'failed', 'approved']),
  // approved is a human-blessed state: code reviewed and accepted, waiting to ship.
  // Satisfies hard dependencies so downstream tasks can unblock before merge.
  approved: new Set<TaskStatus>(['done', 'queued', 'cancelled', 'failed']),
  done: new Set<TaskStatus>(['cancelled']),
  failed: new Set<TaskStatus>(['queued', 'cancelled', 'done']),
  error: new Set<TaskStatus>(['queued', 'cancelled', 'done']),
  cancelled: new Set<TaskStatus>(['done', 'backlog', 'queued'])
}
```

**Add new export** `DEPENDENCY_TRIGGER_STATUSES` after `TERMINAL_STATUSES`:
```typescript
/**
 * Statuses that trigger dependency resolution — terminal statuses plus `approved`,
 * which satisfies hard deps without being fully terminal.
 */
export const DEPENDENCY_TRIGGER_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  ...TERMINAL_STATUSES,
  'approved'
])
```

- [ ] **Step 4: Update `task-statuses.ts`**

In `src/shared/task-statuses.ts`, make these changes:

**TASK_STATUS object** — add `APPROVED`:
```typescript
export const TASK_STATUS = {
  BACKLOG: 'backlog',
  QUEUED: 'queued',
  BLOCKED: 'blocked',
  ACTIVE: 'active',
  REVIEW: 'review',
  APPROVED: 'approved',
  DONE: 'done',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  ERROR: 'error'
} as const satisfies Record<Uppercase<TaskStatus>, TaskStatus>
```

**BucketKey type** — add `'approved'`:
```typescript
export type BucketKey =
  | 'backlog'
  | 'todo'
  | 'blocked'
  | 'inProgress'
  | 'awaitingReview'
  | 'approved'
  | 'done'
  | 'failed'
```

**STATUS_METADATA** — add `approved` entry (Record<TaskStatus, ...> enforces exhaustiveness):
```typescript
approved: {
  label: 'Approved',
  bucketKey: 'approved',
  colorToken: '--fleet-status-done',
  iconName: 'CheckCircle2',
  actionable: true
},
```

Also re-export `DEPENDENCY_TRIGGER_STATUSES` from task-statuses.ts:
```typescript
export {
  TASK_STATUSES,
  TERMINAL_STATUSES,
  FAILURE_STATUSES,
  HARD_SATISFIED_STATUSES,
  DEPENDENCY_TRIGGER_STATUSES,   // add this line
  VALID_TRANSITIONS,
  isValidTransition,
  isTerminal,
  isFailure,
  isHardSatisfied,
  validateTransition
} from './task-state-machine'
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npm test -- --reporter=verbose src/shared/__tests__/task-state-machine.test.ts
```
Expected: all tests pass.

- [ ] **Step 6: Full typecheck**

```bash
npm run typecheck 2>&1 | head -30
```
Expected: zero errors. If `Record<TaskStatus, StatusMetadata>` complains, you missed the `approved` entry in `STATUS_METADATA`.

- [ ] **Step 7: Commit**

```bash
git add src/shared/task-state-machine.ts src/shared/task-statuses.ts
git commit -m "feat(state-machine): add approved status with dependency unblocking semantics"
```

---

### Task 3: IPC Channel Definitions + Shared Types

**Files:**
- Modify: `src/shared/ipc-channels/sprint-channels.ts`
- Modify: `src/shared/types/task-types.ts`

- [ ] **Step 1: Add `PrGroup` interface to `task-types.ts`**

Open `src/shared/types/task-types.ts`. Add after the existing interfaces:

```typescript
export interface PrGroup {
  id: string
  repo: string
  title: string
  branch_name: string
  description: string | null
  status: 'composing' | 'building' | 'open' | 'merged'
  task_order: string[]
  pr_number: number | null
  pr_url: string | null
  created_at: string
  updated_at: string
}
```

Add `stacked_on_task_id` to `SprintTask` (find the existing interface and add the field after `worktree_path`):
```typescript
stacked_on_task_id: string | null
```

- [ ] **Step 2: Add new IPC channels to `sprint-channels.ts`**

In `src/shared/ipc-channels/sprint-channels.ts`, after the existing `ReviewChannels`:

First, add `review:approveTask` to the `ReviewChannels` interface (find the interface and add):
```typescript
'review:approveTask': {
  args: [{ taskId: string }]
  result: { success: boolean }
}
```

Then add a new `PrGroupChannels` interface after `ReviewChannels`:
```typescript
export interface PrGroupChannels {
  'prGroups:list': {
    args: [{ repo?: string | undefined }]
    result: import('../types/task-types').PrGroup[]
  }
  'prGroups:create': {
    args: [{ repo: string; title: string; branchName: string; description?: string | undefined }]
    result: import('../types/task-types').PrGroup
  }
  'prGroups:update': {
    args: [{ id: string; title?: string | undefined; branchName?: string | undefined; description?: string | undefined; taskOrder?: string[] | undefined }]
    result: import('../types/task-types').PrGroup
  }
  'prGroups:addTask': {
    args: [{ groupId: string; taskId: string }]
    result: import('../types/task-types').PrGroup
  }
  'prGroups:removeTask': {
    args: [{ groupId: string; taskId: string }]
    result: import('../types/task-types').PrGroup
  }
  'prGroups:build': {
    args: [{ id: string }]
    result:
      | { success: true; prUrl: string; prNumber: number }
      | { success: false; error: string; conflictingFiles?: string[] | undefined }
  }
  'prGroups:delete': {
    args: [{ id: string }]
    result: { success: boolean }
  }
}
```

Merge `PrGroupChannels` into the exported `IpcChannelMap` (find where the other channel interfaces are merged):
```typescript
export type IpcChannelMap = SprintChannels &
  ReviewChannels &
  PrGroupChannels &          // add this line
  TemplateChannels &
  SynthesizerChannels &
  GroupChannels &
  ReviewPartnerChannels &
  PlannerChannels
```

- [ ] **Step 3: Update `sprint-task-types.ts` allowlists**

In `src/main/data/sprint-task-types.ts`:

Add `'stacked_on_task_id'` to `UPDATE_ALLOWLIST` (after `worktree_path` or `rebase_base_sha`):
```typescript
'stacked_on_task_id',
```

Add `approved` to `QueueStats` interface:
```typescript
interface QueueStats {
  backlog: number
  queued: number
  active: number
  review: number
  approved: number  // add this
  done: number
  failed: number
  cancelled: number
  error: number
  blocked: number
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck 2>&1 | head -30
```
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc-channels/sprint-channels.ts src/shared/types/task-types.ts src/main/data/sprint-task-types.ts
git commit -m "feat(ipc): add approved status types, PrGroup interface, and prGroups:* channels"
```

---

### Task 4: Dependency Resolution — Trigger on `approved`

**Files:**
- Modify: `src/main/lib/resolve-dependents.ts`

- [ ] **Step 1: Write failing test**

Find or create `src/main/lib/__tests__/resolve-dependents.test.ts`. Add:

```typescript
import { resolveDependents } from '../resolve-dependents'
import type { DependencyIndex } from '../../services/dependency-service'

describe('approved status triggers hard dep resolution', () => {
  it('unblocks hard-dep downstream task when upstream reaches approved', () => {
    const updates: Array<{ id: string; status: string }> = []

    const mockIndex = {
      getDependents: (id: string) => id === 'task-a' ? new Set(['task-b']) : new Set(),
      areDependenciesSatisfied: (_depId: string, deps: unknown[], getStatus: (id: string) => string | undefined) => {
        const status = getStatus('task-a')
        return { satisfied: status === 'approved' || status === 'done', blockedBy: [] }
      }
    } as unknown as DependencyIndex

    resolveDependents({
      completedTaskId: 'task-a',
      completedStatus: 'approved',
      index: mockIndex,
      getTask: (id) => {
        if (id === 'task-b') return { id: 'task-b', status: 'blocked', notes: null, title: 'B', group_id: null, depends_on: [{ id: 'task-a', type: 'hard' }] }
        if (id === 'task-a') return { id: 'task-a', status: 'approved', notes: null, title: 'A', group_id: null, depends_on: null }
        return null
      },
      updateTask: (id, patch) => updates.push({ id, status: patch.status as string }),
    })

    expect(updates).toEqual([{ id: 'task-b', status: 'queued' }])
  })

  it('does not trigger on non-terminal, non-approved status', () => {
    const updates: Array<unknown> = []
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const mockIndex = {
      getDependents: () => new Set(['task-b']),
      areDependenciesSatisfied: () => ({ satisfied: false, blockedBy: [] })
    } as unknown as DependencyIndex

    resolveDependents({
      completedTaskId: 'task-a',
      completedStatus: 'active',  // not a trigger status
      index: mockIndex,
      getTask: () => null,
      updateTask: (id, patch) => updates.push(patch),
    })

    expect(updates).toHaveLength(0)
    warnSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm run test:main -- --reporter=verbose 2>&1 | grep -E "(approved|FAIL|PASS)" | head -20
```
Expected: FAIL — `approved` not in TERMINAL_STATUSES so guard returns early.

- [ ] **Step 3: Update `resolve-dependents.ts`**

Open `src/main/lib/resolve-dependents.ts`. Change the import to include `DEPENDENCY_TRIGGER_STATUSES`:

```typescript
import type { TaskStatus } from '../../shared/task-state-machine'
import {
  type DependencyIndex,
  buildBlockedNotes,
  computeBlockState,
  FAILURE_STATUSES,
  TERMINAL_STATUSES
} from '../services/dependency-service'
```

→ Replace the `TERMINAL_STATUSES` import from `dependency-service` with an import that also gets `DEPENDENCY_TRIGGER_STATUSES` from the state machine:

```typescript
import {
  type DependencyIndex,
  buildBlockedNotes,
  computeBlockState,
  FAILURE_STATUSES,
  TERMINAL_STATUSES
} from '../services/dependency-service'
import { DEPENDENCY_TRIGGER_STATUSES } from '../../shared/task-state-machine'
```

Then find the guard at the top of `resolveDependents`:
```typescript
  if (!TERMINAL_STATUSES.has(completedStatus)) {
    logger?.warn(
      `[resolve-dependents] Called with non-terminal status "${completedStatus}" for task ${completedTaskId} — skipping`
    )
    return
  }
```

Change to:
```typescript
  if (!DEPENDENCY_TRIGGER_STATUSES.has(completedStatus)) {
    logger?.warn(
      `[resolve-dependents] Called with non-approval-or-terminal status "${completedStatus}" for task ${completedTaskId} — skipping`
    )
    return
  }
```

Note: `DEPENDENCY_TRIGGER_STATUSES` includes all `TERMINAL_STATUSES` plus `'approved'`. The cascade-cancel check (`shouldCascadeCancel`) uses `FAILURE_STATUSES.has(completedStatus)` — `approved` is not in `FAILURE_STATUSES`, so cascade-cancel will never trigger on approve. That's correct behavior.

- [ ] **Step 4: Run test — expect pass**

```bash
npm run test:main -- --reporter=verbose 2>&1 | grep -E "(approved|FAIL|PASS)" | head -20
```
Expected: all tests pass.

- [ ] **Step 5: Full suite**

```bash
npm run typecheck && npm test
```
Expected: zero errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/lib/resolve-dependents.ts
git commit -m "feat(deps): trigger dependency resolution when upstream task reaches approved"
```

---

## Phase 2 — PR Groups Backend

### Task 5: PR Group Queries (Data Layer)

**Files:**
- Create: `src/main/data/pr-group-queries.ts`

- [ ] **Step 1: Write the data layer**

```typescript
// src/main/data/pr-group-queries.ts
import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { PrGroup } from '../../shared/types/task-types'

function rowToGroup(row: Record<string, unknown>): PrGroup {
  return {
    id: row.id as string,
    repo: row.repo as string,
    title: row.title as string,
    branch_name: row.branch_name as string,
    description: (row.description as string | null) ?? null,
    status: row.status as PrGroup['status'],
    task_order: JSON.parse((row.task_order as string) || '[]') as string[],
    pr_number: (row.pr_number as number | null) ?? null,
    pr_url: (row.pr_url as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function now(): string {
  return new Date().toISOString()
}

export function listPrGroups(repo?: string): PrGroup[] {
  const db = getDb()
  const sql = repo
    ? `SELECT * FROM pr_groups WHERE repo = ? ORDER BY created_at DESC`
    : `SELECT * FROM pr_groups ORDER BY created_at DESC`
  const rows = repo
    ? (db.prepare(sql).all(repo) as Record<string, unknown>[])
    : (db.prepare(sql).all() as Record<string, unknown>[])
  return rows.map(rowToGroup)
}

export function getPrGroup(id: string): PrGroup | null {
  const db = getDb()
  const sql = `SELECT * FROM pr_groups WHERE id = ?`
  const row = db.prepare(sql).get(id) as Record<string, unknown> | undefined
  return row ? rowToGroup(row) : null
}

export interface CreatePrGroupInput {
  repo: string
  title: string
  branchName: string
  description?: string | undefined
}

export function createPrGroup(input: CreatePrGroupInput): PrGroup {
  const db = getDb()
  const id = randomUUID().replace(/-/g, '')
  const ts = now()
  const sql = `
    INSERT INTO pr_groups (id, repo, title, branch_name, description, status, task_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'composing', '[]', ?, ?)
  `
  db.prepare(sql).run(id, input.repo, input.title, input.branchName, input.description ?? null, ts, ts)
  return getPrGroup(id)!
}

export interface UpdatePrGroupInput {
  title?: string | undefined
  branchName?: string | undefined
  description?: string | undefined
  taskOrder?: string[] | undefined
  status?: PrGroup['status'] | undefined
  prNumber?: number | null | undefined
  prUrl?: string | null | undefined
}

export function updatePrGroup(id: string, input: UpdatePrGroupInput): PrGroup | null {
  const db = getDb()
  const group = getPrGroup(id)
  if (!group) return null

  const fields: string[] = []
  const values: unknown[] = []

  if (input.title !== undefined) { fields.push('title = ?'); values.push(input.title) }
  if (input.branchName !== undefined) { fields.push('branch_name = ?'); values.push(input.branchName) }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description) }
  if (input.taskOrder !== undefined) { fields.push('task_order = ?'); values.push(JSON.stringify(input.taskOrder)) }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status) }
  if (input.prNumber !== undefined) { fields.push('pr_number = ?'); values.push(input.prNumber) }
  if (input.prUrl !== undefined) { fields.push('pr_url = ?'); values.push(input.prUrl) }

  if (fields.length === 0) return group

  fields.push('updated_at = ?')
  values.push(now())
  values.push(id)

  const sql = `UPDATE pr_groups SET ${fields.join(', ')} WHERE id = ?`
  db.prepare(sql).run(...values)
  return getPrGroup(id)
}

export function addTaskToGroup(groupId: string, taskId: string): PrGroup | null {
  const group = getPrGroup(groupId)
  if (!group) return null
  if (group.task_order.includes(taskId)) return group
  return updatePrGroup(groupId, { taskOrder: [...group.task_order, taskId] })
}

export function removeTaskFromGroup(groupId: string, taskId: string): PrGroup | null {
  const group = getPrGroup(groupId)
  if (!group) return null
  return updatePrGroup(groupId, { taskOrder: group.task_order.filter((id) => id !== taskId) })
}

export function deletePrGroup(id: string): boolean {
  const db = getDb()
  const sql = `DELETE FROM pr_groups WHERE id = ?`
  const result = db.prepare(sql).run(id)
  return result.changes > 0
}
```

- [ ] **Step 2: Write a smoke test**

Create `src/main/data/__tests__/pr-group-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createPrGroup, listPrGroups, addTaskToGroup, removeTaskFromGroup, deletePrGroup, updatePrGroup } from '../pr-group-queries'

// Mock getDb to use an in-memory DB
vi.mock('../../db', () => {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE pr_groups (
      id TEXT PRIMARY KEY,
      repo TEXT NOT NULL,
      title TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'composing',
      task_order TEXT NOT NULL DEFAULT '[]',
      pr_number INTEGER,
      pr_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  return { getDb: () => db }
})

describe('pr-group-queries', () => {
  beforeEach(() => {
    const { getDb } = require('../../db')
    getDb().exec('DELETE FROM pr_groups')
  })

  it('creates and retrieves a group', () => {
    const group = createPrGroup({ repo: 'fleet', title: 'My PR', branchName: 'feat/my-pr' })
    expect(group.title).toBe('My PR')
    expect(group.status).toBe('composing')
    expect(group.task_order).toEqual([])

    const groups = listPrGroups('fleet')
    expect(groups).toHaveLength(1)
    expect(groups[0]!.id).toBe(group.id)
  })

  it('adds and removes tasks', () => {
    const group = createPrGroup({ repo: 'fleet', title: 'Test', branchName: 'feat/test' })
    const withTask = addTaskToGroup(group.id, 'task-1')
    expect(withTask?.task_order).toEqual(['task-1'])

    const withoutTask = removeTaskFromGroup(group.id, 'task-1')
    expect(withoutTask?.task_order).toEqual([])
  })

  it('updates group fields', () => {
    const group = createPrGroup({ repo: 'fleet', title: 'Old Title', branchName: 'feat/old' })
    const updated = updatePrGroup(group.id, { title: 'New Title', status: 'building' })
    expect(updated?.title).toBe('New Title')
    expect(updated?.status).toBe('building')
  })

  it('deletes a group', () => {
    const group = createPrGroup({ repo: 'fleet', title: 'Delete Me', branchName: 'feat/delete' })
    expect(deletePrGroup(group.id)).toBe(true)
    expect(listPrGroups('fleet')).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run test**

```bash
npm run test:main -- --reporter=verbose pr-group-queries
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/data/pr-group-queries.ts src/main/data/__tests__/pr-group-queries.test.ts
git commit -m "feat(data): pr-group-queries — CRUD for pr_groups table"
```

---

### Task 6: PR Group Build Service

**Files:**
- Create: `src/main/services/pr-group-build-service.ts`

This service replaces `ReviewRollupService`. It handles both single-task PRs (push existing branch) and multi-task rollup PRs (squash-merge). The `topoSort` function from `review-rollup-service.ts` is reused — copy it here.

- [ ] **Step 1: Write the service**

```typescript
// src/main/services/pr-group-build-service.ts
import { join } from 'path'
import { randomBytes } from 'crypto'
import { execFileAsync } from '../lib/async-utils'
import { createLogger } from '../logger'
import { validateGitRef, getWorktreeBase } from '../lib/review-paths'
import { sanitizeForGit, createNewPr } from '../agent-manager/pr-operations'
import { GIT_EXEC_TIMEOUT_MS } from '../agent-manager/worktree-lifecycle'
import { getRepoConfig, getGhRepo } from '../paths'
import { getTask, notifySprintMutation } from './sprint-service'
import { getErrorMessage } from '../../shared/errors'
import type { ISprintTaskRepository } from '../data/sprint-task-repository'
import type { SprintTask } from '../../shared/types/task-types'
import {
  getPrGroup,
  updatePrGroup,
} from '../data/pr-group-queries'

const logger = createLogger('pr-group-build')

export type BuildGroupResult =
  | { success: true; prUrl: string; prNumber: number }
  | { success: false; error: string; conflictingFiles?: string[] | undefined }

export interface DryRunConflictResult {
  hasConflicts: boolean
  conflictingFiles: string[]
}

export interface PrGroupBuildService {
  buildGroup(groupId: string): Promise<BuildGroupResult>
  checkConflicts(groupId: string): Promise<DryRunConflictResult>
}

export function createPrGroupBuildService(repo: ISprintTaskRepository): PrGroupBuildService {
  return {
    buildGroup: (groupId) => buildGroup(groupId, repo),
    checkConflicts: (groupId) => checkGroupConflicts(groupId),
  }
}

async function buildGroup(groupId: string, repo: ISprintTaskRepository): Promise<BuildGroupResult> {
  const group = getPrGroup(groupId)
  if (!group) return { success: false, error: `PR group ${groupId} not found` }
  if (group.status !== 'composing') return { success: false, error: `Group is already ${group.status}` }
  if (group.task_order.length === 0) return { success: false, error: 'No tasks in group' }

  const tasks = loadGroupTasksOrThrow(group.task_order)
  const repoName = tasks[0]!.repo
  const repoConfig = getRepoConfig(repoName)
  if (!repoConfig) return { success: false, error: `Repository "${repoName}" is not configured` }

  const ghRepo = getGhRepo(repoName)
  if (!ghRepo) return { success: false, error: `GitHub owner/repo not configured for "${repoName}"` }

  const env = process.env
  validateGitRef(group.branch_name)

  updatePrGroup(groupId, { status: 'building' })

  try {
    const ordered = topoSort(tasks)
    let prUrl: string
    let prNumber: number

    if (ordered.length === 1) {
      // Single task: push existing branch, create PR directly
      const task = ordered[0]!
      const branch = await currentBranch(task.worktree_path!, env)
      await execFileAsync('git', ['push', '-u', 'origin', branch], {
        cwd: task.worktree_path!,
        env,
        timeout: GIT_EXEC_TIMEOUT_MS,
      })
      const title = group.title || sanitizeForGit(task.title)
      const body = group.description ?? buildSingleTaskPrBody(task)
      const result = await createNewPr(task.worktree_path!, branch, title, ghRepo, env, logger, body)
      prUrl = result.prUrl
      prNumber = result.prNumber
    } else {
      // Multi-task rollup: squash-merge in dependency order
      const repoPath = repoConfig.localPath
      await fetchOriginMain(repoPath, env)
      const rollupPath = join(getWorktreeBase(), 'rollup', randomBytes(4).toString('hex'))
      await createRollupWorktree(repoPath, group.branch_name, rollupPath, env)
      try {
        const mergeResult = await squashMergeTasks(rollupPath, ordered, env)
        if (!mergeResult.success) {
          updatePrGroup(groupId, { status: 'composing' })
          return { success: false, error: mergeResult.error, conflictingFiles: mergeResult.conflictingFiles }
        }
        await execFileAsync('git', ['push', '-u', 'origin', group.branch_name], {
          cwd: rollupPath,
          env,
          timeout: GIT_EXEC_TIMEOUT_MS,
        })
        const body = group.description ?? buildRollupPrBody(ordered)
        const result = await createNewPr(rollupPath, group.branch_name, group.title, ghRepo, env, logger, body)
        prUrl = result.prUrl
        prNumber = result.prNumber
      } finally {
        await cleanupWorktree(repoPath, rollupPath, group.branch_name, env)
      }
    }

    if (!prUrl || prNumber === null) {
      updatePrGroup(groupId, { status: 'composing' })
      return { success: false, error: 'PR creation failed — no URL returned' }
    }

    await updateTaskPrFields(ordered, prNumber, prUrl, repo)
    updatePrGroup(groupId, { status: 'open', prNumber, prUrl })
    logger.info(`[pr-group] built PR ${prUrl} for group ${groupId} (${ordered.length} tasks)`)
    return { success: true, prUrl, prNumber }
  } catch (err) {
    updatePrGroup(groupId, { status: 'composing' })
    return { success: false, error: getErrorMessage(err) }
  }
}

async function checkGroupConflicts(groupId: string): Promise<DryRunConflictResult> {
  const group = getPrGroup(groupId)
  if (!group || group.task_order.length < 2) return { hasConflicts: false, conflictingFiles: [] }

  const tasks = loadGroupTasksOrThrow(group.task_order)
  const ordered = topoSort(tasks)
  const repoName = ordered[0]!.repo
  const repoConfig = getRepoConfig(repoName)
  if (!repoConfig) return { hasConflicts: false, conflictingFiles: [] }

  const env = process.env
  const repoPath = repoConfig.localPath
  await fetchOriginMain(repoPath, env)
  const rollupPath = join(getWorktreeBase(), 'rollup-dry', randomBytes(4).toString('hex'))
  await createRollupWorktree(repoPath, `dry-run-${randomBytes(4).toString('hex')}`, rollupPath, env)

  try {
    for (const task of ordered) {
      const branch = await currentBranch(task.worktree_path!, env)
      try {
        await execFileAsync('git', ['merge', '--no-commit', '--no-ff', branch], {
          cwd: rollupPath, env, timeout: GIT_EXEC_TIMEOUT_MS,
        })
        await execFileAsync('git', ['merge', '--abort'], { cwd: rollupPath, env, timeout: GIT_EXEC_TIMEOUT_MS }).catch(() => {})
        await execFileAsync('git', ['reset', '--hard', 'HEAD'], { cwd: rollupPath, env, timeout: GIT_EXEC_TIMEOUT_MS })
      } catch {
        const conflictingFiles = await extractConflictFiles(rollupPath, env)
        await execFileAsync('git', ['merge', '--abort'], { cwd: rollupPath, env, timeout: GIT_EXEC_TIMEOUT_MS }).catch(() => {})
        return { hasConflicts: true, conflictingFiles }
      }
    }
    return { hasConflicts: false, conflictingFiles: [] }
  } finally {
    await cleanupWorktree(repoPath, rollupPath, `dry-run-*`, env).catch(() => {})
  }
}

// ── Git helpers ──────────────────────────────────────────────────────────────

async function fetchOriginMain(repoPath: string, env: NodeJS.ProcessEnv): Promise<void> {
  await execFileAsync('git', ['fetch', 'origin', 'main'], { cwd: repoPath, env, timeout: GIT_EXEC_TIMEOUT_MS })
}

async function createRollupWorktree(repoPath: string, branchName: string, path: string, env: NodeJS.ProcessEnv): Promise<void> {
  await execFileAsync('git', ['worktree', 'add', '-b', branchName, path, 'origin/main'], { cwd: repoPath, env, timeout: GIT_EXEC_TIMEOUT_MS })
}

async function currentBranch(worktreePath: string, env: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await execFileAsync('git', ['branch', '--show-current'], { cwd: worktreePath, env, timeout: GIT_EXEC_TIMEOUT_MS })
  const branch = stdout.trim()
  if (!branch) throw new Error(`Could not determine branch for worktree at ${worktreePath}`)
  return branch
}

interface SquashResult { success: true }
interface SquashFailure { success: false; error: string; conflictingFiles: string[] }

async function squashMergeTasks(rollupPath: string, tasks: SprintTask[], env: NodeJS.ProcessEnv): Promise<SquashResult | SquashFailure> {
  for (const task of tasks) {
    const branch = await currentBranch(task.worktree_path!, env)
    try {
      await execFileAsync('git', ['merge', '--squash', branch], { cwd: rollupPath, env, timeout: GIT_EXEC_TIMEOUT_MS })
    } catch {
      const conflictingFiles = await extractConflictFiles(rollupPath, env)
      await execFileAsync('git', ['merge', '--abort'], { cwd: rollupPath, env, timeout: GIT_EXEC_TIMEOUT_MS }).catch(() => {})
      return { success: false, error: `Merge conflict in task "${task.title}"`, conflictingFiles }
    }
    await execFileAsync('git', ['commit', '-m', `feat: ${sanitizeForGit(task.title)} (#${task.id.slice(0, 8)})`], { cwd: rollupPath, env, timeout: GIT_EXEC_TIMEOUT_MS })
  }
  return { success: true }
}

async function extractConflictFiles(path: string, env: NodeJS.ProcessEnv): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--name-only', '--diff-filter=U'], { cwd: path, env, timeout: GIT_EXEC_TIMEOUT_MS })
    return stdout.trim().split('\n').filter(Boolean)
  } catch { return [] }
}

async function cleanupWorktree(repoPath: string, path: string, branch: string, env: NodeJS.ProcessEnv): Promise<void> {
  await execFileAsync('git', ['worktree', 'remove', '--force', path], { cwd: repoPath, env, timeout: GIT_EXEC_TIMEOUT_MS }).catch((err) => {
    logger.warn(`[pr-group] cleanup worktree: ${getErrorMessage(err)}`)
  })
  await execFileAsync('git', ['branch', '-D', branch], { cwd: repoPath, env, timeout: GIT_EXEC_TIMEOUT_MS }).catch(() => {})
}

// ── Task helpers ─────────────────────────────────────────────────────────────

function loadGroupTasksOrThrow(taskIds: string[]): SprintTask[] {
  return taskIds.map((id) => {
    const task = getTask(id)
    if (!task) throw new Error(`Task ${id} not found`)
    if (task.status !== 'approved') throw new Error(`Task "${task.title}" is not in approved status`)
    if (!task.worktree_path) throw new Error(`Task "${task.title}" has no worktree`)
    return task
  })
}

async function updateTaskPrFields(tasks: SprintTask[], prNumber: number, prUrl: string, repo: ISprintTaskRepository): Promise<void> {
  await Promise.all(tasks.map(async (task) => {
    const updated = await repo.updateTask(task.id, { pr_number: prNumber, pr_url: prUrl, pr_status: 'open' }, { caller: 'pr-group-build' })
    if (updated) notifySprintMutation('updated', updated)
  }))
}

function buildSingleTaskPrBody(task: SprintTask): string {
  return (task.spec ?? task.prompt ?? `## Summary\n\n${sanitizeForGit(task.title)}`).slice(0, 4000)
}

function buildRollupPrBody(tasks: SprintTask[]): string {
  const taskList = tasks.map((t) => `- **${sanitizeForGit(t.title)}** (\`${t.id.slice(0, 8)}\`)`).join('\n')
  return `## Bundled Tasks\n\n${taskList}\n\n🤖 PR built by FLEET`
}

// ── Topological sort (Kahn's algorithm) ──────────────────────────────────────

export function topoSort(tasks: SprintTask[]): SprintTask[] {
  const idSet = new Set(tasks.map((t) => t.id))
  const indexById = new Map(tasks.map((t, i) => [t.id, i]))
  const inDegree = new Map(tasks.map((t) => [t.id, 0]))
  const successors = new Map(tasks.map((t) => [t.id, [] as string[]]))

  for (const task of tasks) {
    for (const dep of task.depends_on ?? []) {
      if (idSet.has(dep.id)) {
        successors.get(dep.id)!.push(task.id)
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
      }
    }
  }

  const queue = tasks
    .filter((t) => inDegree.get(t.id) === 0)
    .sort((a, b) => (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0))

  const result: SprintTask[] = []
  const taskById = new Map(tasks.map((t) => [t.id, t]))

  while (queue.length > 0) {
    const task = queue.shift()!
    result.push(task)
    for (const nextId of successors.get(task.id) ?? []) {
      const deg = (inDegree.get(nextId) ?? 1) - 1
      inDegree.set(nextId, deg)
      if (deg === 0) queue.push(taskById.get(nextId)!)
    }
  }

  // Cycle fallback (shouldn't occur — creation-time detection)
  const resultIds = new Set(result.map((t) => t.id))
  tasks.filter((t) => !resultIds.has(t.id)).forEach((t) => result.push(t))
  return result
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep "pr-group-build" | head -20
```
Expected: zero errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/main/services/pr-group-build-service.ts
git commit -m "feat(services): pr-group-build-service — per-group PR creation replacing ReviewRollupService"
```

---

### Task 7: Sprint PR Poller — Watch `approved` Tasks

**Files:**
- Modify: `src/main/sprint-pr-poller.ts`

- [ ] **Step 1: Read the file**

```bash
cat src/main/sprint-pr-poller.ts | grep -n "pr_status\|status\|WHERE\|SELECT" | head -20
```
Find the SQL query that selects tasks to poll. It currently selects tasks where `pr_status = 'open'`. You need it to also include tasks where `status = 'approved'`.

- [ ] **Step 2: Update the query**

Find the SQL that fetches tasks to poll (looks like `SELECT ... WHERE pr_status = 'open'` or similar). The current query likely only allows `status = 'review'`. Update it to also include `status = 'approved'`:

The condition changes from something like:
```sql
WHERE pr_status = 'open' AND status = 'review'
```
To:
```sql
WHERE pr_status = 'open' AND (status = 'review' OR status = 'approved')
```

If the query uses a parameterized list of statuses, add `'approved'` to that list.

- [ ] **Step 3: Typecheck + test**

```bash
npm run typecheck && npm run test:main -- --reporter=verbose 2>&1 | grep -E "(poller|FAIL|PASS)" | head -20
```
Expected: zero errors, existing poller tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/sprint-pr-poller.ts
git commit -m "feat(poller): watch approved tasks with pr_status=open for merge detection"
```

---

### Task 8: IPC Handlers — `review:approveTask` + `prGroups:*`

**Files:**
- Modify: `src/main/handlers/review.ts`
- Create: `src/main/handlers/pr-groups.ts`

- [ ] **Step 1: Add `review:approveTask` to review.ts**

Open `src/main/handlers/review.ts`. At the end of `registerReviewHandlers`, add:

```typescript
  safeHandle('review:approveTask', async (_e, payload) => {
    const { taskId } = payload
    if (!isValidTaskId(taskId)) throw new Error('Invalid task ID format')
    const task = getTask(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)
    if (task.status !== 'review') throw new Error(`Task ${taskId} is not in review status — cannot approve`)

    const updated = await deps.taskStateService.transition(taskId, 'approved', {
      caller: 'review:approveTask'
    })
    if (!updated) throw new Error(`Failed to transition task ${taskId} to approved`)

    // `approved` is not terminal — TaskTerminalService / onStatusTerminal will NOT fire automatically.
    // Read `src/main/services/task-state-service.ts` to confirm. If transition() doesn't auto-resolve
    // deps for non-terminal statuses, call deps.onStatusTerminal(taskId, 'approved') explicitly —
    // Task 4 updated resolve-dependents to accept `approved` via DEPENDENCY_TRIGGER_STATUSES.
    return { success: true }
  })
```

- [ ] **Step 2: Create `pr-groups.ts` handler**

```typescript
// src/main/handlers/pr-groups.ts
import { safeHandle } from '../ipc-utils'
import { isValidTaskId } from '../lib/validation'
import {
  listPrGroups,
  createPrGroup,
  updatePrGroup,
  addTaskToGroup,
  removeTaskFromGroup,
  deletePrGroup,
} from '../data/pr-group-queries'
import type { PrGroupBuildService } from '../services/pr-group-build-service'

export interface PrGroupHandlersDeps {
  prGroupBuild: PrGroupBuildService
}

export function registerPrGroupHandlers(deps: PrGroupHandlersDeps): void {
  safeHandle('prGroups:list', async (_e, payload) => {
    return listPrGroups(payload.repo)
  })

  safeHandle('prGroups:create', async (_e, payload) => {
    const group = createPrGroup({
      repo: payload.repo,
      title: payload.title,
      branchName: payload.branchName,
      description: payload.description,
    })
    return group
  })

  safeHandle('prGroups:update', async (_e, payload) => {
    const { id, title, branchName, description, taskOrder } = payload
    const updated = updatePrGroup(id, { title, branchName, description, taskOrder })
    if (!updated) throw new Error(`PR group ${id} not found`)
    return updated
  })

  safeHandle('prGroups:addTask', async (_e, payload) => {
    if (!isValidTaskId(payload.taskId)) throw new Error('Invalid task ID format')
    const updated = addTaskToGroup(payload.groupId, payload.taskId)
    if (!updated) throw new Error(`PR group ${payload.groupId} not found`)
    return updated
  })

  safeHandle('prGroups:removeTask', async (_e, payload) => {
    const updated = removeTaskFromGroup(payload.groupId, payload.taskId)
    if (!updated) throw new Error(`PR group ${payload.groupId} not found`)
    return updated
  })

  safeHandle('prGroups:build', async (_e, payload) => {
    return deps.prGroupBuild.buildGroup(payload.id)
  })

  safeHandle('prGroups:delete', async (_e, payload) => {
    const deleted = deletePrGroup(payload.id)
    return { success: deleted }
  })
}
```

- [ ] **Step 3: Register handlers in `src/main/index.ts`**

Open `src/main/index.ts`. Find where other handlers are imported and registered. Add:

```typescript
import { registerPrGroupHandlers } from './handlers/pr-groups'
import { createPrGroupBuildService } from './services/pr-group-build-service'
```

And in the handler registration section:
```typescript
const prGroupBuild = createPrGroupBuildService(repo)
registerPrGroupHandlers({ prGroupBuild })
```

- [ ] **Step 4: Update preload bridge in `src/preload/index.ts`**

In the `review` API object, add:
```typescript
approveTask: (payload: { taskId: string }) =>
  typedInvoke('review:approveTask', payload),
```

Add a new `prGroups` API object (after the `review` export):
```typescript
export const prGroups = {
  list: (payload: { repo?: string }) =>
    typedInvoke('prGroups:list', payload),
  create: (payload: { repo: string; title: string; branchName: string; description?: string }) =>
    typedInvoke('prGroups:create', payload),
  update: (payload: { id: string; title?: string; branchName?: string; description?: string; taskOrder?: string[] }) =>
    typedInvoke('prGroups:update', payload),
  addTask: (payload: { groupId: string; taskId: string }) =>
    typedInvoke('prGroups:addTask', payload),
  removeTask: (payload: { groupId: string; taskId: string }) =>
    typedInvoke('prGroups:removeTask', payload),
  build: (payload: { id: string }) =>
    typedInvoke('prGroups:build', payload),
  delete: (payload: { id: string }) =>
    typedInvoke('prGroups:delete', payload),
}
```

Also expose `prGroups` on `window.api` — find where `window.api` is constructed and add `prGroups`.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck 2>&1 | head -30
```
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/handlers/review.ts src/main/handlers/pr-groups.ts src/main/index.ts src/preload/index.ts
git commit -m "feat(ipc): approveTask and prGroups handlers + preload bridge"
```

---

## Phase 3 — Frontend

### Task 9: Partition + Status UI — `approved` Bucket

**Files:**
- Modify: `src/renderer/src/lib/partitionSprintTasks.ts`

- [ ] **Step 1: Write failing test**

Find the existing test for `partitionSprintTasks` (search for it in `src/renderer/src/lib/__tests__/`). Add:

```typescript
it('routes approved tasks to the approved bucket', () => {
  const task = { id: '1', status: 'approved', pr_status: null } as SprintTask
  const result = partitionSprintTasks([task])
  expect(result.approved).toHaveLength(1)
  expect(result.pendingReview).toHaveLength(0)
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- partitionSprintTasks --reporter=verbose
```
Expected: FAIL — `result.approved` is not a property yet.

- [ ] **Step 3: Update `partitionSprintTasks.ts`**

Add `approved` to the `SprintPartition` interface:
```typescript
export interface SprintPartition {
  backlog: SprintTask[]
  todo: SprintTask[]
  blocked: SprintTask[]
  inProgress: SprintTask[]
  pendingReview: SprintTask[]
  approved: SprintTask[]          // tasks in approved status
  openPrs: SprintTask[]
  done: SprintTask[]
  failed: SprintTask[]
}
```

Add `const approved: SprintTask[] = []` with the other array declarations.

Add to the switch statement:
```typescript
case 'approved':
  approved.push(task)
  break
```

Add `approved` to the return object.

- [ ] **Step 4: Run tests**

```bash
npm test -- partitionSprintTasks --reporter=verbose
```
Expected: all tests pass.

- [ ] **Step 5: Full typecheck**

```bash
npm run typecheck 2>&1 | head -20
```
Expected: zero errors. TypeScript will catch any consumer that destructures `SprintPartition` without handling `approved`.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/partitionSprintTasks.ts
git commit -m "feat(ui): add approved bucket to SprintPartition"
```

---

### Task 10: PR Groups Zustand Store

**Files:**
- Create: `src/renderer/src/stores/prGroups.ts`

- [ ] **Step 1: Write the store**

```typescript
// src/renderer/src/stores/prGroups.ts
import { create } from 'zustand'
import type { PrGroup, SprintTask } from '../../../shared/types/task-types'

interface PrGroupsState {
  groups: PrGroup[]
  buildingGroupIds: Set<string>
  error: string | null

  loadGroups(repo?: string): Promise<void>
  createGroup(repo: string, title: string, branchName: string, description?: string): Promise<PrGroup>
  updateGroup(id: string, updates: { title?: string; branchName?: string; description?: string; taskOrder?: string[] }): Promise<void>
  addTask(groupId: string, taskId: string): Promise<void>
  removeTask(groupId: string, taskId: string): Promise<void>
  buildGroup(id: string): Promise<{ success: boolean; prUrl?: string; error?: string; conflictingFiles?: string[] }>
  deleteGroup(id: string): Promise<void>
}

export const usePrGroupsStore = create<PrGroupsState>((set, get) => ({
  groups: [],
  buildingGroupIds: new Set(),
  error: null,

  async loadGroups(repo?: string) {
    try {
      const groups = await window.api.prGroups.list({ repo })
      set({ groups, error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load PR groups' })
    }
  },

  async createGroup(repo, title, branchName, description) {
    const group = await window.api.prGroups.create({ repo, title, branchName, description })
    set((s) => ({ groups: [group, ...s.groups] }))
    return group
  },

  async updateGroup(id, updates) {
    const updated = await window.api.prGroups.update({ id, ...updates })
    set((s) => ({ groups: s.groups.map((g) => (g.id === id ? updated : g)) }))
  },

  async addTask(groupId, taskId) {
    const updated = await window.api.prGroups.addTask({ groupId, taskId })
    set((s) => ({ groups: s.groups.map((g) => (g.id === groupId ? updated : g)) }))
  },

  async removeTask(groupId, taskId) {
    const updated = await window.api.prGroups.removeTask({ groupId, taskId })
    set((s) => ({ groups: s.groups.map((g) => (g.id === groupId ? updated : g)) }))
  },

  async buildGroup(id) {
    set((s) => ({ buildingGroupIds: new Set([...s.buildingGroupIds, id]) }))
    try {
      const result = await window.api.prGroups.build({ id })
      if (result.success) {
        await get().loadGroups()
      }
      return result.success
        ? { success: true, prUrl: result.prUrl }
        : { success: false, error: result.error, conflictingFiles: result.conflictingFiles }
    } finally {
      set((s) => {
        const next = new Set(s.buildingGroupIds)
        next.delete(id)
        return { buildingGroupIds: next }
      })
    }
  },

  async deleteGroup(id) {
    await window.api.prGroups.delete({ id })
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }))
  },
}))

export function selectUnassignedApprovedTasks(tasks: SprintTask[], groups: PrGroup[], repo: string): SprintTask[] {
  const assignedTaskIds = new Set(groups.flatMap((g) => g.task_order))
  return tasks.filter((t) => t.status === 'approved' && t.repo === repo && !assignedTaskIds.has(t.id))
}

export function selectGroupsForRepo(groups: PrGroup[], repo: string): PrGroup[] {
  return groups.filter((g) => g.repo === repo)
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep "prGroups" | head -10
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/stores/prGroups.ts
git commit -m "feat(stores): prGroups Zustand store"
```

---

### Task 11: `useApproveAction` Hook

**Files:**
- Create: `src/renderer/src/hooks/useApproveAction.ts`

- [ ] **Step 1: Write the hook**

```typescript
// src/renderer/src/hooks/useApproveAction.ts
import { useState } from 'react'
import { toast } from 'sonner'

export interface UseApproveActionResult {
  approve: () => Promise<void>
  inFlight: boolean
}

export function useApproveAction(taskId: string, onSuccess: () => void): UseApproveActionResult {
  const [inFlight, setInFlight] = useState(false)

  const approve = async (): Promise<void> => {
    setInFlight(true)
    try {
      await window.api.review.approveTask({ taskId })
      toast.success('Task approved — dependents unblocked')
      onSuccess()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve task')
    } finally {
      setInFlight(false)
    }
  }

  return { approve, inFlight }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep "useApproveAction" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/hooks/useApproveAction.ts
git commit -m "feat(hooks): useApproveAction — approve task with toast feedback"
```

---

### Task 12: `usePrGroups` Hook

**Files:**
- Create: `src/renderer/src/hooks/usePrGroups.ts`

- [ ] **Step 1: Write the hook**

```typescript
// src/renderer/src/hooks/usePrGroups.ts
import { useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { usePrGroupsStore, selectGroupsForRepo, selectUnassignedApprovedTasks } from '../stores/prGroups'
import { useSprintTasksStore } from '../stores/sprintTasks'
import type { PrGroup } from '../../../shared/types/task-types'

export interface UsePrGroupsResult {
  groups: PrGroup[]
  buildingGroupIds: Set<string>
  unassignedTasksForRepo: ReturnType<typeof selectUnassignedApprovedTasks>
  createGroup: (title: string, branchName: string, description?: string) => Promise<PrGroup>
  updateGroup: (id: string, updates: { title?: string; branchName?: string; description?: string; taskOrder?: string[] }) => Promise<void>
  addTask: (groupId: string, taskId: string) => Promise<void>
  removeTask: (groupId: string, taskId: string) => Promise<void>
  buildGroup: (id: string) => Promise<void>
  deleteGroup: (id: string) => Promise<void>
  reload: () => void
}

export function usePrGroups(repo: string): UsePrGroupsResult {
  const store = usePrGroupsStore()
  const tasks = useSprintTasksStore((s) => s.tasks)

  useEffect(() => {
    store.loadGroups(repo)
  }, [repo])

  const reload = useCallback(() => store.loadGroups(repo), [repo])

  const groups = selectGroupsForRepo(store.groups, repo)
  const unassignedTasksForRepo = selectUnassignedApprovedTasks(tasks, store.groups, repo)

  const createGroup = useCallback(async (title: string, branchName: string, description?: string) => {
    const group = await store.createGroup(repo, title, branchName, description)
    return group
  }, [repo])

  const buildGroup = useCallback(async (id: string) => {
    const result = await store.buildGroup(id)
    if (result.success) {
      toast.success('PR created', {
        action: result.prUrl ? { label: 'Open PR', onClick: () => window.open(result.prUrl, '_blank') } : undefined
      })
      reload()
    } else {
      toast.error(result.error ?? 'PR creation failed')
    }
  }, [reload])

  return {
    groups,
    buildingGroupIds: store.buildingGroupIds,
    unassignedTasksForRepo,
    createGroup,
    updateGroup: store.updateGroup,
    addTask: store.addTask,
    removeTask: store.removeTask,
    buildGroup,
    deleteGroup: store.deleteGroup,
    reload,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep "usePrGroups" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/hooks/usePrGroups.ts
git commit -m "feat(hooks): usePrGroups — PR group management with repo scoping"
```

---

### Task 13: Code Review Station — Two Sections + Approve Action

**Files:**
- Modify: `src/renderer/src/components/code-review/ReviewActionsBar.tsx` (or equivalent action bar)
- Modify: `src/renderer/src/views/CodeReviewView.tsx` (task list sidebar)
- Modify: `src/renderer/src/components/code-review/TopBar.tsx`

Before editing, read each of these three files completely to understand their current structure. The changes below are additive.

- [ ] **Step 1: Read the files**

```bash
cat src/renderer/src/views/CodeReviewView.tsx | head -100
cat src/renderer/src/components/code-review/ReviewActionsBar.tsx | head -60
cat src/renderer/src/components/code-review/TopBar.tsx | head -60
```

- [ ] **Step 2: Split task list into two sections in CodeReviewView**

Find where the code review view renders the list of tasks (currently filtered to `status === 'review'`). Change the filter to show both `review` and `approved` tasks, but split them into two sections:

```typescript
// In CodeReviewView.tsx — find the tasks filter and split into two lists:
const pendingReviewTasks = tasks.filter((t) => t.status === 'review')
const approvedTasks = tasks.filter((t) => t.status === 'approved')
```

Render the sidebar as two collapsible sections:

```tsx
{/* Pending Review section */}
<section>
  <h3 className="review-section-header">Pending Review ({pendingReviewTasks.length})</h3>
  {pendingReviewTasks.map((task) => (
    <ReviewQueueItem key={task.id} task={task} ... />
  ))}
</section>

{/* Approved section */}
<section>
  <div className="review-section-header-row">
    <h3 className="review-section-header">Approved ({approvedTasks.length})</h3>
    {approvedTasks.length > 0 && (
      <button onClick={() => setShowPrBuilder(true)} className="build-pr-btn">
        Build PR
      </button>
    )}
  </div>
  {approvedTasks.map((task) => (
    <ReviewQueueItem key={task.id} task={task} ... />
  ))}
</section>

{/* PR Builder modal */}
<PrBuilderModal
  open={showPrBuilder}
  repo={selectedRepo}
  onClose={() => setShowPrBuilder(false)}
/>
```

Add `const [showPrBuilder, setShowPrBuilder] = useState(false)` to the component state.

- [ ] **Step 3: Add "Approve" button to action bar**

In `ReviewActionsBar.tsx` (or wherever action buttons are rendered for a selected task), add the Approve button. It should only appear when `task.status === 'review'`:

```tsx
import { useApproveAction } from '../../hooks/useApproveAction'

// Inside the component, after existing hooks:
const { approve, inFlight: approveInFlight } = useApproveAction(task.id, loadData)

// In the render:
{task.status === 'review' && (
  <button
    onClick={approve}
    disabled={approveInFlight || !!actionInFlight}
    className="action-btn action-btn--primary"
  >
    {approveInFlight ? 'Approving...' : 'Approve'}
  </button>
)}
```

- [ ] **Step 4: For approved-status tasks, show Build PR as primary action**

When `task.status === 'approved'`, the primary action in the action bar becomes "Build PR" (opens the PR Builder modal), not "Approve". You can use `task.status === 'approved' && (...)` guards on existing action buttons to hide/show appropriately.

- [ ] **Step 5: Typecheck + visual test**

```bash
npm run typecheck && npm run dev
```
Open the Code Review Station. Verify:
- Tasks in `review` show "Approve" button
- Tasks in `approved` show without "Approve" button
- "Build PR" button appears in the Approved section header when there are approved tasks
- The two sections render independently

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/views/CodeReviewView.tsx src/renderer/src/components/code-review/ReviewActionsBar.tsx src/renderer/src/components/code-review/TopBar.tsx
git commit -m "feat(ui): code review station — Approve action and two-section sidebar"
```

---

### Task 14: PrBuilderModal Component

**Files:**
- Create: `src/renderer/src/components/code-review/PrBuilderModal.tsx`

- [ ] **Step 1: Read the Modal primitive**

```bash
cat src/renderer/src/components/ui/Modal.tsx | head -60
```
Note the `size` prop options and how to wrap content.

- [ ] **Step 2: Write the component**

```tsx
// src/renderer/src/components/code-review/PrBuilderModal.tsx
import { useState, useCallback } from 'react'
import { Modal } from '../ui/Modal'
import { usePrGroups } from '../../hooks/usePrGroups'
import type { PrGroup, SprintTask } from '../../../../shared/types/task-types'

interface PrBuilderModalProps {
  open: boolean
  repo: string
  onClose: () => void
}

export function PrBuilderModal({ open, repo, onClose }: PrBuilderModalProps) {
  const {
    groups,
    buildingGroupIds,
    unassignedTasksForRepo,
    createGroup,
    updateGroup,
    addTask,
    removeTask,
    buildGroup,
    deleteGroup,
  } = usePrGroups(repo)

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)

  const handleDrop = useCallback(async (groupId: string, taskId: string) => {
    await addTask(groupId, taskId)
    setDraggingTaskId(null)
  }, [addTask])

  return (
    <Modal open={open} onClose={onClose} size="fullscreen" title="PR Builder">
      <div className="pr-builder">
        {/* Left panel — unassigned approved tasks */}
        <aside className="pr-builder__pool">
          <h3 className="pr-builder__panel-title">Unassigned Tasks</h3>
          <p className="pr-builder__hint">Drag tasks into a PR group →</p>
          <ul className="pr-builder__task-list">
            {unassignedTasksForRepo.map((task) => (
              <UnassignedTaskRow
                key={task.id}
                task={task}
                onDragStart={() => setDraggingTaskId(task.id)}
              />
            ))}
            {unassignedTasksForRepo.length === 0 && (
              <li className="pr-builder__empty">No unassigned approved tasks</li>
            )}
          </ul>
        </aside>

        {/* Right panel — PR group cards */}
        <main className="pr-builder__groups">
          <div className="pr-builder__groups-header">
            <h3 className="pr-builder__panel-title">PR Groups</h3>
            <button
              className="pr-builder__new-group-btn"
              onClick={() => createGroup('New PR', `feat/pr-${Date.now()}`, undefined)}
            >
              + New Group
            </button>
          </div>

          {groups.length === 0 && (
            <div className="pr-builder__empty-groups">
              No PR groups yet. Create one or drag a task here.
            </div>
          )}

          {groups.map((group) => (
            <PrGroupCard
              key={group.id}
              group={group}
              building={buildingGroupIds.has(group.id)}
              draggingTaskId={draggingTaskId}
              onDrop={handleDrop}
              onUpdateGroup={updateGroup}
              onRemoveTask={removeTask}
              onBuild={buildGroup}
              onDelete={deleteGroup}
            />
          ))}
        </main>
      </div>
    </Modal>
  )
}

// ── UnassignedTaskRow ────────────────────────────────────────────────────────

function UnassignedTaskRow({ task, onDragStart }: { task: SprintTask; onDragStart: () => void }) {
  return (
    <li
      className="pr-builder__pool-task"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
        onDragStart()
      }}
    >
      <span className="pr-builder__task-title">{task.title}</span>
      <span className="pr-builder__task-branch">{task.worktree_path?.split('/').pop() ?? ''}</span>
    </li>
  )
}

// ── PrGroupCard ──────────────────────────────────────────────────────────────

interface PrGroupCardProps {
  group: PrGroup
  building: boolean
  draggingTaskId: string | null
  onDrop: (groupId: string, taskId: string) => Promise<void>
  onUpdateGroup: (id: string, updates: { title?: string; branchName?: string; description?: string; taskOrder?: string[] }) => Promise<void>
  onRemoveTask: (groupId: string, taskId: string) => Promise<void>
  onBuild: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function PrGroupCard({ group, building, draggingTaskId, onDrop, onUpdateGroup, onRemoveTask, onBuild, onDelete }: PrGroupCardProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) await onDrop(group.id, taskId)
  }

  const isMultiTask = group.task_order.length > 1
  const canBuild = group.task_order.length > 0 && group.status === 'composing' && !building

  return (
    <div
      className={`pr-group-card ${dragOver ? 'pr-group-card--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="pr-group-card__header">
        <span className="pr-group-card__type-badge">
          {isMultiTask ? `${group.task_order.length} tasks` : '1 task'}
        </span>
        <button
          className="pr-group-card__delete-btn"
          onClick={() => onDelete(group.id)}
          disabled={building}
          aria-label="Delete group"
        >
          ×
        </button>
      </div>

      {/* Task list */}
      <ul className="pr-group-card__tasks">
        {group.task_order.map((taskId) => (
          <li key={taskId} className="pr-group-card__task-row">
            <span className="pr-group-card__task-id">{taskId.slice(0, 8)}</span>
            <button
              className="pr-group-card__remove-task"
              onClick={() => onRemoveTask(group.id, taskId)}
              aria-label="Remove from group"
            >
              ↩
            </button>
          </li>
        ))}
        {group.task_order.length === 0 && (
          <li className="pr-group-card__drop-hint">Drop tasks here</li>
        )}
      </ul>

      {/* PR fields */}
      <div className="pr-group-card__fields">
        <input
          className="pr-group-card__input"
          placeholder="PR title"
          defaultValue={group.title}
          onBlur={(e) => onUpdateGroup(group.id, { title: e.target.value })}
        />
        <input
          className="pr-group-card__input"
          placeholder="Branch name"
          defaultValue={group.branch_name}
          onBlur={(e) => onUpdateGroup(group.id, { branchName: e.target.value })}
        />
        <textarea
          className="pr-group-card__textarea"
          placeholder="PR description (optional)"
          defaultValue={group.description ?? ''}
          onBlur={(e) => onUpdateGroup(group.id, { description: e.target.value })}
          rows={3}
        />
      </div>

      {/* Build button */}
      <button
        className="pr-group-card__build-btn"
        onClick={() => onBuild(group.id)}
        disabled={!canBuild}
      >
        {building ? 'Building PR...' : group.status === 'open' ? 'PR Open ↗' : 'Build PR'}
      </button>

      {group.pr_url && group.status === 'open' && (
        <a href={group.pr_url} target="_blank" rel="noreferrer" className="pr-group-card__pr-link">
          View PR →
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire `PrBuilderModal` into CodeReviewView**

Add the import at the top of `CodeReviewView.tsx`:
```typescript
import { PrBuilderModal } from '../components/code-review/PrBuilderModal'
```

Make sure `setShowPrBuilder` and `selectedRepo` are wired correctly from Task 13.

- [ ] **Step 4: Typecheck + dev test**

```bash
npm run typecheck && npm run dev
```
Test in the app:
- Open Code Review Station with approved tasks
- Click "Build PR" — PrBuilderModal opens
- Drag unassigned tasks into a group card
- Fill in PR title/description
- Click "Build PR" on a group

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/code-review/PrBuilderModal.tsx
git commit -m "feat(ui): PrBuilderModal — persistent PR group composer"
```

---

## Phase 4 — Agent Manager

### Task 15: Fork-on-Approve in Worktree Setup

**Files:**
- Modify: `src/main/agent-manager/worktree.ts`
- Modify: drain loop (read `src/main/agent-manager/index.ts` first to find the claim/spawn logic)

Before editing, read the worktree setup and drain loop:
```bash
grep -n "setupWorktree\|origin/main\|baseBranch\|worktree add" src/main/agent-manager/worktree.ts | head -20
grep -n "claimTask\|setupWorktree\|depends_on\|approved" src/main/agent-manager/index.ts | head -30
```

- [ ] **Step 1: Add `baseBranch` option to `SetupWorktreeOpts`**

In `src/main/agent-manager/worktree.ts`, find the `SetupWorktreeOpts` interface and add:

```typescript
/** Override the base branch for the worktree (defaults to 'origin/main'). */
baseBranch?: string | undefined
```

Find the `git worktree add` call in `setupWorktree`. It currently uses `origin/main` as the base. Change it to use `opts.baseBranch ?? 'origin/main'`:

```typescript
await execFileAsync('git', ['worktree', 'add', '-b', branch, worktreePath, opts.baseBranch ?? 'origin/main'], { ... })
```

- [ ] **Step 2: Detect approved parent in drain loop**

In the drain loop (in `src/main/agent-manager/index.ts` or wherever tasks are claimed and `setupWorktree` is called), after a task is claimed, check if any of its hard dependencies are in `approved` status. If so, use that task's branch as the base:

```typescript
// After claiming a task:
async function resolveBaseBranch(task: SprintTask, repo: ISprintTaskRepository): Promise<string> {
  if (!task.depends_on || task.depends_on.length === 0) return 'origin/main'
  
  for (const dep of task.depends_on) {
    if (dep.type !== 'hard' && dep.condition !== 'on_success') continue
    const depTask = await repo.getTask(dep.id)
    if (!depTask || depTask.status !== 'approved' || !depTask.worktree_path) continue
    
    // Get the branch name from the approved task's worktree
    try {
      const { stdout } = await execFileAsync('git', ['branch', '--show-current'], {
        cwd: depTask.worktree_path,
        env,
        timeout: GIT_EXEC_TIMEOUT_MS,
      })
      const branch = stdout.trim()
      if (branch) return branch  // use direct parent's branch as base
    } catch {
      // fall through to origin/main
    }
  }
  
  return 'origin/main'
}
```

Call `resolveBaseBranch` before `setupWorktree` and pass the result as `baseBranch`. Also store `stacked_on_task_id` on the task if a stacked base was found:

```typescript
const baseBranch = await resolveBaseBranch(task, repo)
const isStacked = baseBranch !== 'origin/main'

if (isStacked) {
  const parentId = /* the dep.id whose branch we're using */
  await repo.updateTask(task.id, { stacked_on_task_id: parentId }, { caller: 'drain-loop.fork' })
}

const { worktreePath, branch } = await setupWorktree({
  repoPath,
  worktreeBase,
  taskId: task.id,
  title: task.title,
  baseBranch,
})
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep "worktree\|baseBranch" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/main/agent-manager/worktree.ts src/main/agent-manager/index.ts
git commit -m "feat(agent-manager): fork worktree from approved parent branch when task is stacked"
```

---

### Task 16: Auto-Rebase in Completion Pipeline

**Files:**
- Modify: `src/main/agent-manager/success-pipeline.ts`

Before editing:
```bash
grep -n "review\|rebase\|stacked\|transition" src/main/agent-manager/success-pipeline.ts | head -20
```

Find where the task transitions from `active` to `review`. Add a rebase step before the transition if `stacked_on_task_id` is set.

- [ ] **Step 1: Read the success pipeline**

```bash
cat src/main/agent-manager/success-pipeline.ts | head -80
```

- [ ] **Step 2: Add pre-review rebase for stacked tasks**

Find the function that handles the `active → review` transition (likely a phase called `promoteToReview` or similar). Before transitioning, check `stacked_on_task_id`:

```typescript
async function rebaseStackedBranchIfNeeded(task: SprintTask, env: NodeJS.ProcessEnv, logger: Logger): Promise<'clean' | 'conflict'> {
  if (!task.stacked_on_task_id || !task.worktree_path) return 'clean'

  logger.info(`[success-pipeline] rebasing stacked task ${task.id} onto origin/main`)
  try {
    await execFileAsync('git', ['fetch', 'origin', 'main'], { cwd: task.worktree_path, env, timeout: GIT_EXEC_TIMEOUT_MS })
    await execFileAsync('git', ['rebase', 'origin/main'], { cwd: task.worktree_path, env, timeout: GIT_EXEC_TIMEOUT_MS })
    logger.info(`[success-pipeline] rebase clean for ${task.id}`)
    return 'clean'
  } catch {
    // Rebase failed — abort and let human resolve
    await execFileAsync('git', ['rebase', '--abort'], { cwd: task.worktree_path, env, timeout: GIT_EXEC_TIMEOUT_MS }).catch(() => {})
    logger.warn(`[success-pipeline] rebase conflict for ${task.id} — promoting to review with conflict note`)
    return 'conflict'
  }
}
```

Call this before the `review` transition:

```typescript
const rebaseResult = await rebaseStackedBranchIfNeeded(task, env, logger)

const revisionFeedback = rebaseResult === 'conflict'
  ? [{ timestamp: new Date().toISOString(), feedback: 'Rebase conflict after upstream task merged to main. Resolve conflicts before merging.', mode: 'note' as const }]
  : undefined

// Existing transition to review:
await repo.updateTask(task.id, {
  status: 'review',
  ...(revisionFeedback ? { revision_feedback: revisionFeedback } : {}),
}, { caller: 'success-pipeline' })
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep "success-pipeline" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/main/agent-manager/success-pipeline.ts
git commit -m "feat(agent-manager): rebase stacked task onto origin/main before promoting to review"
```

---

## Phase 5 — Cleanup

### Task 17: Retire RollupPrModal + ReviewRollupService

**Files:**
- Delete: `src/renderer/src/components/code-review/RollupPrModal.tsx`
- Delete: `src/main/services/review-rollup-service.ts`

- [ ] **Step 1: Find all importers**

```bash
grep -r "RollupPrModal\|review-rollup-service\|reviewRollup\|buildRollupPr" src/ --include="*.ts" --include="*.tsx" -l
```

- [ ] **Step 2: Remove each import and usage**

For each file that imports `RollupPrModal`: replace with `PrBuilderModal` or remove the import if the trigger already routes through the new modal.

For `review.ts` handler: the `review:buildRollupPr` channel + handler can be kept temporarily (backward compat with any MCP clients calling it) or removed if there are no external callers. Remove the `reviewRollup` dependency from `ReviewHandlersDeps` if removing.

For `index.ts`: remove `ReviewRollupService` instantiation and injection.

For `preload/index.ts`: remove `buildRollupPr` from the `review` API (or keep temporarily for compat).

- [ ] **Step 3: Delete the files**

```bash
rm src/renderer/src/components/code-review/RollupPrModal.tsx
rm src/main/services/review-rollup-service.ts
```

- [ ] **Step 4: Full suite**

```bash
npm run typecheck && npm test && npm run lint
```
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: retire RollupPrModal and ReviewRollupService — replaced by PrBuilderModal and PrGroupBuildService"
```

---

### Task 18: Module Documentation

**Files:**
- Modify: `docs/modules/services/index.md`
- Modify: `docs/modules/handlers/index.md`
- Modify: `docs/modules/data/index.md`
- Modify: `docs/modules/stores/index.md`
- Modify: `docs/modules/hooks/index.md`
- Modify: `docs/modules/components/index.md`
- Modify: `docs/modules/shared/index.md`

Per CLAUDE.md: update the index row for every file created or modified. Add rows for new modules; update rows for changed ones; remove rows for deleted ones.

- [ ] **Step 1: Update each index**

For each layer, open the index.md and add/update rows for the files touched in this feature:

**services/index.md** — add `pr-group-build-service.ts`; remove `review-rollup-service.ts`

**handlers/index.md** — add `pr-groups.ts`; note `review.ts` updated

**data/index.md** — add `pr-group-queries.ts`

**stores/index.md** — add `prGroups.ts`

**hooks/index.md** — add `useApproveAction.ts`, `usePrGroups.ts`

**components/index.md** — add `PrBuilderModal.tsx` (group: `code-review`); remove `RollupPrModal.tsx`

**shared/index.md** — note `task-state-machine.ts`, `task-statuses.ts`, `task-types.ts`, `sprint-channels.ts` updated

- [ ] **Step 2: Commit**

```bash
git add docs/modules/
git commit -m "chore(docs): update module index for pr-builder feature"
```

---

## Verification

Run this end-to-end after all tasks are complete:

1. `npm run typecheck` — zero errors
2. `npm test` — all tests pass
3. `npm run test:main` — all main process tests pass
4. `npm run lint` — zero errors
5. `npm run dev` — start the app

Manual flow:
1. Complete an agent task → appears in "Pending Review"
2. Click **Approve** → task moves to "Approved" section, toast confirms
3. If another task had a hard dep on the approved task: confirm it transitioned `blocked → queued`
4. Queue the downstream task; confirm its worktree is forked from the approved task's branch (check `git log --oneline` in the worktree)
5. Downstream task finishes → check that rebase ran (task enters review cleanly)
6. Click **Build PR** in the Approved section → PrBuilderModal opens
7. Drag the approved task into a group card
8. Fill in PR title + description
9. Click **Build PR** on the card → progress updates, PR URL returned, task gets `pr_status='open'`
10. With two approved tasks: drag both into the same group → click Build PR → squash-merge rollup, single PR created
11. Merge the GitHub PR → Sprint PR Poller transitions task(s) to `done` within 60s
