# Code Review Station Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PR Station with a local Code Review view that gates agent output behind user approval, supporting local merge, PR creation, and agent revision requests.

**Architecture:** New `review` task status between `active` and `done`. Agent completion stops at `review` with worktree alive. Code Review view provides diff/commit browsing, inline comments, and approve/revise/discard actions. Reuses existing diff components.

**Tech Stack:** TypeScript, React, Zustand, SQLite (better-sqlite3), Electron IPC, git CLI

**Spec:** `docs/superpowers/specs/2026-04-01-code-review-station-design.md`

---

## File Structure

### New Files

| File                                                                       | Responsibility                                                                                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/main/handlers/review.ts`                                              | 7 IPC handlers for review actions (getDiff, getCommits, getFileDiff, mergeLocally, createPr, requestRevision, discard) |
| `src/main/handlers/__tests__/review.test.ts`                               | Handler tests + handler count assertion                                                                                |
| `src/renderer/src/views/CodeReviewView.tsx`                                | Top-level view: review queue sidebar + detail panel                                                                    |
| `src/renderer/src/components/code-review/ReviewQueue.tsx`                  | Left sidebar list of tasks in `review` status                                                                          |
| `src/renderer/src/components/code-review/ReviewDetail.tsx`                 | 3-tab detail panel (Changes, Commits, Conversation)                                                                    |
| `src/renderer/src/components/code-review/ReviewActions.tsx`                | Bottom action bar (Merge Locally, Create PR, Revise, Discard)                                                          |
| `src/renderer/src/components/code-review/ChangesTab.tsx`                   | File tree + diff viewer integration                                                                                    |
| `src/renderer/src/components/code-review/CommitsTab.tsx`                   | Commit history list with per-commit diff                                                                               |
| `src/renderer/src/components/code-review/ConversationTab.tsx`              | Spec display, comments thread, revision input                                                                          |
| `src/renderer/src/stores/codeReview.ts`                                    | Zustand store: selected task, active tab, comments, loading states                                                     |
| `src/renderer/src/stores/__tests__/codeReview.test.ts`                     | Store unit tests                                                                                                       |
| `src/renderer/src/components/code-review/__tests__/ReviewQueue.test.tsx`   | Component tests                                                                                                        |
| `src/renderer/src/components/code-review/__tests__/ReviewActions.test.tsx` | Component tests                                                                                                        |
| `src/renderer/src/styles/code-review-neon.css`                             | Neon-styled CSS (`.cr-*` BEM prefix)                                                                                   |

### Modified Files

| File                                           | Change                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/shared/types.ts`                          | Add `'review'` to `TaskStatus` union                                               |
| `src/shared/constants.ts`                      | Add `REVIEW: 'review'` to `TASK_STATUS`                                            |
| `src/shared/queue-api-contract.ts`             | Add `'review'` to `RUNNER_WRITABLE_STATUSES`                                       |
| `src/shared/ipc-channels.ts`                   | Add `ReviewChannels` interface, composite into `IpcChannelMap`                     |
| `src/main/db.ts`                               | Migration v20: add `worktree_path`, `session_id` columns + `review_comments` table |
| `src/main/agent-manager/completion.ts`         | `resolveSuccess` stops at `review` instead of push+PR                              |
| `src/main/agent-manager/run-agent.ts`          | Skip worktree cleanup on success, persist `session_id`                             |
| `src/main/agent-manager/worktree.ts`           | `pruneStaleWorktrees` skips review-status worktrees                                |
| `src/main/index.ts`                            | Import + register review handlers, wire terminal service                           |
| `src/preload/index.ts`                         | Add `review` namespace to API bridge                                               |
| `src/preload/index.d.ts`                       | Add `review` type declarations                                                     |
| `src/renderer/src/lib/view-registry.ts`        | Replace `pr-station` with `code-review`                                            |
| `src/renderer/src/lib/view-resolver.tsx`       | Replace PRStationView lazy import with CodeReviewView                              |
| `src/renderer/src/stores/panelLayout.ts`       | Replace `'pr-station'` with `'code-review'` in View union                          |
| `src/renderer/src/lib/partitionSprintTasks.ts` | Map `review` status to `awaitingReview` bucket                                     |
| `src/renderer/src/assets/main.css`             | Replace pr-station CSS imports with code-review-neon.css                           |

---

## Task 1: Add `review` Status to Shared Contracts

**Files:**

- Modify: `src/shared/types.ts`
- Modify: `src/shared/constants.ts`
- Modify: `src/shared/queue-api-contract.ts`

- [ ] **Step 1: Add `review` to TaskStatus union in types.ts**

In `src/shared/types.ts`, find the `status` field in the `SprintTask` interface and add `'review'`:

```typescript
status: 'backlog' |
  'queued' |
  'blocked' |
  'active' |
  'review' |
  'done' |
  'cancelled' |
  'failed' |
  'error'
```

Also update the standalone `TaskStatus` type alias if one exists.

- [ ] **Step 2: Add REVIEW to TASK_STATUS constant in constants.ts**

In `src/shared/constants.ts`, add to the `TASK_STATUS` object:

```typescript
export const TASK_STATUS = {
  BACKLOG: 'backlog',
  QUEUED: 'queued',
  BLOCKED: 'blocked',
  ACTIVE: 'active',
  REVIEW: 'review',
  DONE: 'done',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  ERROR: 'error'
} as const
```

- [ ] **Step 3: Add `review` to RUNNER_WRITABLE_STATUSES in queue-api-contract.ts**

In `src/shared/queue-api-contract.ts`:

```typescript
export const RUNNER_WRITABLE_STATUSES = new Set([
  'queued',
  'blocked',
  'active',
  'review',
  'done',
  'failed',
  'cancelled',
  'error'
])
```

- [ ] **Step 4: Add valid transitions for `review`**

Find `VALID_TRANSITIONS` (likely in `constants.ts` or `sprint-queries.ts`) and update:

```typescript
active: ['review', 'done', 'failed', 'error', 'cancelled'],
review: ['done', 'active', 'cancelled'],
```

- [ ] **Step 5: Run typecheck to verify no breakage**

Run: `npm run typecheck`
Expected: PASS — `review` is now a valid status everywhere the union is used.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/shared/constants.ts src/shared/queue-api-contract.ts
git commit -m "feat: add review status to task state machine"
```

---

## Task 2: Database Migration v20

**Files:**

- Modify: `src/main/db.ts`

- [ ] **Step 1: Add migration v20 to the migrations array**

In `src/main/db.ts`, add a new migration entry after the last one (v19):

```typescript
{
  version: 20,
  up: (db: Database) => {
    // Add worktree_path and session_id to sprint_tasks
    db.exec(`ALTER TABLE sprint_tasks ADD COLUMN worktree_path TEXT`)
    db.exec(`ALTER TABLE sprint_tasks ADD COLUMN session_id TEXT`)

    // Update CHECK constraint to include 'review' status
    // This requires table recreation — follow the v17 pattern with full column list
    // Copy data, drop old table, create new with updated CHECK, copy back

    // Create review_comments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS review_comments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        file_path TEXT,
        line_number INTEGER,
        body TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        revision_number INTEGER NOT NULL DEFAULT 1
      )
    `)
  }
}
```

**Important:** The `sprint_tasks` table has a CHECK constraint on `status`. Adding `'review'` requires recreating the table (same pattern as migration v15 and v17). Use the full column list from v17 plus the two new columns. Never use `SELECT *`.

- [ ] **Step 2: Run tests to verify migration applies cleanly**

Run: `npm run test:main`
Expected: PASS — migration runs on test DBs without error.

- [ ] **Step 3: Commit**

```bash
git add src/main/db.ts
git commit -m "feat: migration v20 — add review status, worktree_path, session_id, review_comments table"
```

---

## Task 3: Update Partition Logic and View Registry

**Files:**

- Modify: `src/renderer/src/lib/partitionSprintTasks.ts`
- Modify: `src/renderer/src/lib/view-registry.ts`
- Modify: `src/renderer/src/lib/view-resolver.tsx`
- Modify: `src/renderer/src/stores/panelLayout.ts`
- Modify: `src/renderer/src/assets/main.css`
- Create: `src/renderer/src/styles/code-review-neon.css` (empty placeholder)

- [ ] **Step 1: Update partitionSprintTasks to handle `review` status**

In `src/renderer/src/lib/partitionSprintTasks.ts`, add a case for `review` in the switch/if chain:

```typescript
// Tasks with status 'review' go into awaitingReview
case TASK_STATUS.REVIEW:
  partition.awaitingReview.push(task)
  break
```

Remove or simplify the old `awaitingReview` logic that checked `pr_status=open` on active/done tasks. Now `review` status is the canonical way into that bucket.

- [ ] **Step 2: Replace `pr-station` with `code-review` in View type union**

In `src/renderer/src/stores/panelLayout.ts`, update the `View` type:

```typescript
// Replace 'pr-station' with 'code-review'
export type View =
  | 'dashboard'
  | 'agents'
  | 'ide'
  | 'sprint'
  | 'code-review'
  | 'git'
  | 'settings'
  | 'task-workbench'
```

- [ ] **Step 3: Update view-registry.ts**

In `src/renderer/src/lib/view-registry.ts`:

```typescript
import { GitCompareArrows } from 'lucide-react'

// Replace pr-station entry with:
'code-review': { label: 'Code Review', icon: GitCompareArrows, shortcut: '⌘5', shortcutKey: '5' },
```

Remove the `pr-station` entry. Update `VIEW_SHORTCUT_MAP` accordingly.

- [ ] **Step 4: Update view-resolver.tsx**

In `src/renderer/src/lib/view-resolver.tsx`:

```typescript
// Replace:
const PRStationView = lazy(() => import('../views/PRStationView'))
// With:
const CodeReviewView = lazy(() => import('../views/CodeReviewView'))

// In resolveView switch:
// Replace:
case 'pr-station': return <PRStationView />
// With:
case 'code-review': return <CodeReviewView />
```

- [ ] **Step 5: Create placeholder CodeReviewView**

Create `src/renderer/src/views/CodeReviewView.tsx`:

```typescript
export default function CodeReviewView() {
  return (
    <div className="cr-view">
      <h2>Code Review</h2>
      <p>Review queue coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 6: Create empty code-review-neon.css and update main.css**

Create `src/renderer/src/styles/code-review-neon.css`:

```css
/* Code Review Station — neon styles */
/* BEM prefix: .cr-* */

.cr-view {
  display: flex;
  height: 100%;
  gap: 1px;
  background: var(--bde-bg);
}
```

In `src/renderer/src/assets/main.css`, replace the pr-station CSS imports:

```css
/* Replace: */
/* @import '../styles/pr-station.css'; */
/* @import '../styles/pr-station-neon.css'; */
/* With: */
@import '../styles/code-review-neon.css';
```

- [ ] **Step 7: Add layout migration for saved panel layouts**

In `panelLayout.ts`, in the layout restoration/deserialization logic, add a migration that replaces any saved `'pr-station'` tab with `'code-review'`:

```typescript
// When restoring layout from settings, migrate old view keys:
function migrateLayout(node: PanelNode): PanelNode {
  if (node.type === 'leaf') {
    return {
      ...node,
      tabs: node.tabs.map((tab) =>
        tab.viewKey === 'pr-station' ? { ...tab, viewKey: 'code-review' } : tab
      )
    }
  }
  return { ...node, children: [migrateLayout(node.children[0]), migrateLayout(node.children[1])] }
}
```

- [ ] **Step 8: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: PASS — may need to fix PR Station test imports. Any test referencing `'pr-station'` as a view key needs updating to `'code-review'`.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/lib/ src/renderer/src/stores/panelLayout.ts src/renderer/src/views/CodeReviewView.tsx src/renderer/src/styles/code-review-neon.css src/renderer/src/assets/main.css
git commit -m "feat: replace PR Station view with Code Review placeholder"
```

---

## Task 4: IPC Channel Types and Preload Bridge

**Files:**

- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Add ReviewChannels interface to ipc-channels.ts**

In `src/shared/ipc-channels.ts`, add after the last channel interface:

```typescript
export interface ReviewChannels {
  'review:getDiff': {
    args: [payload: { worktreePath: string; base: string }]
    result: {
      files: Array<{
        path: string
        status: string
        additions: number
        deletions: number
        patch: string
      }>
    }
  }
  'review:getCommits': {
    args: [payload: { worktreePath: string; base: string }]
    result: { commits: Array<{ hash: string; message: string; author: string; date: string }> }
  }
  'review:getFileDiff': {
    args: [payload: { worktreePath: string; filePath: string; base: string }]
    result: { diff: string }
  }
  'review:mergeLocally': {
    args: [payload: { taskId: string; strategy: 'squash' | 'merge' | 'rebase' }]
    result: { success: boolean; conflicts?: string[]; error?: string }
  }
  'review:createPr': {
    args: [payload: { taskId: string; title: string; body: string }]
    result: { prUrl: string }
  }
  'review:requestRevision': {
    args: [payload: { taskId: string; feedback: string; mode: 'resume' | 'fresh' }]
    result: { success: boolean }
  }
  'review:discard': {
    args: [payload: { taskId: string }]
    result: { success: boolean }
  }
}
```

Add `ReviewChannels` to the `IpcChannelMap` intersection:

```typescript
export type IpcChannelMap = SettingsChannels &
  GitChannels &
  // ... existing ...
  ReviewChannels
```

- [ ] **Step 2: Add review namespace to preload/index.ts**

In `src/preload/index.ts`, add to the `api` object:

```typescript
review: {
  getDiff: (payload: { worktreePath: string; base: string }) =>
    typedInvoke('review:getDiff', payload),
  getCommits: (payload: { worktreePath: string; base: string }) =>
    typedInvoke('review:getCommits', payload),
  getFileDiff: (payload: { worktreePath: string; filePath: string; base: string }) =>
    typedInvoke('review:getFileDiff', payload),
  mergeLocally: (payload: { taskId: string; strategy: 'squash' | 'merge' | 'rebase' }) =>
    typedInvoke('review:mergeLocally', payload),
  createPr: (payload: { taskId: string; title: string; body: string }) =>
    typedInvoke('review:createPr', payload),
  requestRevision: (payload: { taskId: string; feedback: string; mode: 'resume' | 'fresh' }) =>
    typedInvoke('review:requestRevision', payload),
  discard: (payload: { taskId: string }) =>
    typedInvoke('review:discard', payload),
},
```

- [ ] **Step 3: Add review type declarations to preload/index.d.ts**

In `src/preload/index.d.ts`, add to the `Window.api` interface:

```typescript
review: {
  getDiff: (payload: { worktreePath: string; base: string }) => Promise<IpcResult<'review:getDiff'>>
  getCommits: (payload: { worktreePath: string; base: string }) =>
    Promise<IpcResult<'review:getCommits'>>
  getFileDiff: (payload: { worktreePath: string; filePath: string; base: string }) =>
    Promise<IpcResult<'review:getFileDiff'>>
  mergeLocally: (payload: { taskId: string; strategy: 'squash' | 'merge' | 'rebase' }) =>
    Promise<IpcResult<'review:mergeLocally'>>
  createPr: (payload: { taskId: string; title: string; body: string }) =>
    Promise<IpcResult<'review:createPr'>>
  requestRevision: (payload: { taskId: string; feedback: string; mode: 'resume' | 'fresh' }) =>
    Promise<IpcResult<'review:requestRevision'>>
  discard: (payload: { taskId: string }) => Promise<IpcResult<'review:discard'>>
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — channels are typed but handlers don't exist yet (that's fine, preload just wraps `ipcRenderer.invoke`).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc-channels.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: add review IPC channel types and preload bridge"
```

---

## Task 5: Agent Completion — Stop at `review` Instead of Push+PR

**Files:**

- Modify: `src/main/agent-manager/completion.ts`
- Modify: `src/main/agent-manager/run-agent.ts`
- Modify: `src/main/agent-manager/worktree.ts`

- [ ] **Step 1: Modify resolveSuccess to transition to `review`**

In `src/main/agent-manager/completion.ts`, replace the push+PR logic in `resolveSuccess` with:

```typescript
// Instead of pushing and creating PR:
// 1. Set task status to 'review' with worktree_path
await repo.updateTask(task.id, {
  status: 'review',
  worktree_path: opts.worktreePath,
  claimed_by: null // Release claim so UI can act on it
})

// 2. Do NOT clean up worktree — user needs it for review
// 3. Do NOT call onTaskTerminal — review is not terminal
```

Keep the existing auto-commit logic (git add -A + commit) so the worktree has clean committed state when the user reviews.

- [ ] **Step 2: Modify run-agent.ts to skip worktree cleanup on success**

In `src/main/agent-manager/run-agent.ts`, find the worktree cleanup call after agent completion. Wrap it in a condition:

```typescript
// Only clean up worktree on failure — success keeps it alive for review
if (isTerminal) {
  cleanupWorktree({
    repoPath,
    worktreePath: worktree.worktreePath,
    branch: worktree.branch
  }).catch(/* existing error handler */)
}
// On success (review), worktree stays alive
```

- [ ] **Step 3: Persist session_id from SDK in run-agent.ts**

In `run-agent.ts`, after the SDK query starts and emits a `system/init` message, capture the session ID:

```typescript
// When processing SDK stream messages, look for system/init:
if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
  await repo.updateTask(task.id, { session_id: msg.session_id })
}
```

- [ ] **Step 4: Update pruneStaleWorktrees to skip review tasks**

In `src/main/agent-manager/worktree.ts`, modify `pruneStaleWorktrees`:

```typescript
// Before pruning, check if the worktree belongs to a task in review status
const reviewTasks = repo.listTasks({ status: 'review' })
const reviewWorktrees = new Set(reviewTasks.map((t) => t.worktree_path).filter(Boolean))

// Skip cleanup if this path is a review worktree
if (reviewWorktrees.has(worktreePath)) {
  logger.info(`[worktree] Skipping prune of review worktree: ${worktreePath}`)
  continue
}
```

- [ ] **Step 5: Run test:main to verify agent manager tests pass**

Run: `npm run test:main`
Expected: Some tests may need updating — completion tests that assert PR creation now need to assert `status='review'` instead.

- [ ] **Step 6: Commit**

```bash
git add src/main/agent-manager/completion.ts src/main/agent-manager/run-agent.ts src/main/agent-manager/worktree.ts
git commit -m "feat: agent completion stops at review status, preserves worktree"
```

---

## Task 6: Review IPC Handlers

**Files:**

- Create: `src/main/handlers/review.ts`
- Create: `src/main/handlers/__tests__/review.test.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create review handler module**

Create `src/main/handlers/review.ts`. Use `execFileAsync` (argument arrays, not string interpolation) for all git/gh CLI calls. Follow the `safeHandle()` pattern from existing handlers.

Key handlers:

- `review:getDiff` — runs `git diff --stat --patch base...HEAD` in worktree via `execFileAsync`
- `review:getCommits` — runs `git log base..HEAD --format=...` via `execFileAsync`
- `review:getFileDiff` — runs `git diff base...HEAD -- filePath` via `execFileAsync`
- `review:mergeLocally` — merge/squash/rebase branch into main repo, clean up worktree, mark done via terminal service
- `review:createPr` — push branch via `execFileAsync('git', ['push', ...])`, create PR via `execFileAsync('gh', ['pr', 'create', ...])`, update task PR fields
- `review:requestRevision` — store feedback comment, transition task to `queued` (resume keeps session_id, fresh clears it)
- `review:discard` — clean up worktree, mark cancelled via terminal service

```typescript
import { execFileAsync } from '../exec-utils'
import { safeHandle } from '../handlers-shared'
import { createLogger } from '../logger'
import type { ISprintTaskRepository } from '../data/sprint-task-repository'

const logger = createLogger('review-handlers')

let repo: ISprintTaskRepository
let onStatusTerminal: ((taskId: string, status: string) => void) | null = null

export function setReviewRepo(r: ISprintTaskRepository) {
  repo = r
}
export function setReviewOnStatusTerminal(fn: (taskId: string, status: string) => void) {
  onStatusTerminal = fn
}

export function registerReviewHandlers() {
  safeHandle('review:getDiff', async ({ worktreePath, base }) => {
    const { stdout } = await execFileAsync('git', ['diff', '--stat', '--patch', `${base}...HEAD`], {
      cwd: worktreePath,
      maxBuffer: 10 * 1024 * 1024
    })
    return { files: parseDiffOutput(stdout) }
  })

  safeHandle('review:getCommits', async ({ worktreePath, base }) => {
    const { stdout } = await execFileAsync(
      'git',
      ['log', `${base}..HEAD`, '--format=%H|%s|%an|%aI', '--reverse'],
      { cwd: worktreePath }
    )
    const commits = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, message, author, date] = line.split('|')
        return { hash, message, author, date }
      })
    return { commits }
  })

  safeHandle('review:getFileDiff', async ({ worktreePath, filePath, base }) => {
    const { stdout } = await execFileAsync('git', ['diff', `${base}...HEAD`, '--', filePath], {
      cwd: worktreePath,
      maxBuffer: 10 * 1024 * 1024
    })
    return { diff: stdout }
  })

  safeHandle('review:mergeLocally', async ({ taskId, strategy }) => {
    const task = repo.getTask(taskId)
    if (!task?.worktree_path) throw new Error('Task has no worktree_path')

    const { stdout: branchRaw } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: task.worktree_path }
    )
    const branchName = branchRaw.trim()

    // Resolve repo local path from settings
    // const repoPath = ...

    try {
      if (strategy === 'squash') {
        await execFileAsync('git', ['merge', '--squash', branchName], { cwd: repoPath })
        await execFileAsync('git', ['commit', '-m', task.title], { cwd: repoPath })
      } else if (strategy === 'merge') {
        await execFileAsync('git', ['merge', '--no-ff', branchName], { cwd: repoPath })
      } else {
        await execFileAsync('git', ['rebase', branchName], { cwd: repoPath })
      }
    } catch (err: unknown) {
      await execFileAsync('git', ['merge', '--abort'], { cwd: repoPath }).catch(() => {})
      await execFileAsync('git', ['rebase', '--abort'], { cwd: repoPath }).catch(() => {})
      return { success: false, conflicts: extractConflictFiles(err) }
    }

    // Clean up worktree + mark done
    await cleanupReviewWorktree(task.worktree_path, branchName, repoPath)
    repo.updateTask(taskId, {
      status: 'done',
      worktree_path: null,
      session_id: null,
      completed_at: new Date().toISOString()
    })
    onStatusTerminal?.(taskId, 'done')
    return { success: true }
  })

  safeHandle('review:createPr', async ({ taskId, title, body }) => {
    const task = repo.getTask(taskId)
    if (!task?.worktree_path) throw new Error('Task has no worktree_path')

    const { stdout: branchRaw } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: task.worktree_path }
    )
    const branchName = branchRaw.trim()

    await execFileAsync('git', ['push', 'origin', branchName], { cwd: task.worktree_path })
    const { stdout: prOutput } = await execFileAsync(
      'gh',
      ['pr', 'create', '--title', title, '--body', body, '--head', branchName],
      { cwd: task.worktree_path }
    )

    const prUrl = prOutput.trim()
    const prNumber = parseInt(prUrl.split('/').pop() || '0', 10)

    // Clean up worktree
    // const repoPath = ...
    await cleanupReviewWorktree(task.worktree_path, branchName, repoPath)

    repo.updateTask(taskId, {
      pr_url: prUrl,
      pr_number: prNumber,
      pr_status: 'open',
      worktree_path: null,
      session_id: null
    })

    return { prUrl }
  })

  safeHandle('review:requestRevision', async ({ taskId, feedback, mode }) => {
    const task = repo.getTask(taskId)
    if (!task) throw new Error('Task not found')

    // Store feedback as review comment in review_comments table
    // INSERT INTO review_comments (id, task_id, body, author) VALUES (...)

    if (mode === 'fresh') {
      repo.updateTask(taskId, { status: 'queued', session_id: null, claimed_by: null })
    } else {
      repo.updateTask(taskId, { status: 'queued', claimed_by: null })
    }

    return { success: true }
  })

  safeHandle('review:discard', async ({ taskId }) => {
    const task = repo.getTask(taskId)
    if (!task) throw new Error('Task not found')

    if (task.worktree_path) {
      const { stdout: branchRaw } = await execFileAsync(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: task.worktree_path }
      )
      // const repoPath = ...
      await cleanupReviewWorktree(task.worktree_path, branchRaw.trim(), repoPath)
    }

    repo.updateTask(taskId, {
      status: 'cancelled',
      worktree_path: null,
      session_id: null,
      completed_at: new Date().toISOString()
    })
    onStatusTerminal?.(taskId, 'cancelled')
    return { success: true }
  })
}

// Helper: clean up worktree and delete branch
async function cleanupReviewWorktree(worktreePath: string, branch: string, repoPath: string) {
  await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
    cwd: repoPath
  }).catch(() => execFileAsync('rm', ['-rf', worktreePath]))
  await execFileAsync('git', ['branch', '-D', branch], { cwd: repoPath }).catch(() => {})
}

function parseDiffOutput(raw: string) {
  // Parse unified diff into structured file list
  // Implementation: split on 'diff --git' boundaries, extract path + status + hunks
  return []
}

function extractConflictFiles(err: unknown): string[] {
  const msg = err instanceof Error ? err.message : String(err)
  // Parse conflict file paths from git merge/rebase error output
  return []
}
```

- [ ] **Step 2: Register handlers in index.ts**

In `src/main/index.ts`:

```typescript
import { registerReviewHandlers, setReviewRepo, setReviewOnStatusTerminal } from './handlers/review'

// After repo and terminal service are created:
setReviewRepo(repo)
setReviewOnStatusTerminal(terminalService.onStatusTerminal)
registerReviewHandlers()
```

- [ ] **Step 3: Create handler tests**

Create `src/main/handlers/__tests__/review.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('review handlers', () => {
  it('registers 7 handlers', () => {
    // Assert safeHandle called 7 times
    // Follow pattern from existing handler tests
  })

  // Test each handler's error paths:
  // - getDiff with invalid worktree path
  // - mergeLocally with missing worktree_path
  // - discard with nonexistent task
  // - createPr with push failure
})
```

- [ ] **Step 4: Run tests**

Run: `npm run test:main`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/handlers/review.ts src/main/handlers/__tests__/review.test.ts src/main/index.ts
git commit -m "feat: add review IPC handlers for code review actions"
```

---

## Task 7: Code Review Zustand Store

**Files:**

- Create: `src/renderer/src/stores/codeReview.ts`
- Create: `src/renderer/src/stores/__tests__/codeReview.test.ts`

- [ ] **Step 1: Write failing tests for the store**

Create `src/renderer/src/stores/__tests__/codeReview.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useCodeReviewStore } from '../codeReview'

describe('codeReviewStore', () => {
  beforeEach(() => {
    useCodeReviewStore.getState().reset()
  })

  it('selects a task for review', () => {
    useCodeReviewStore.getState().selectTask('task-123')
    expect(useCodeReviewStore.getState().selectedTaskId).toBe('task-123')
  })

  it('switches active tab', () => {
    useCodeReviewStore.getState().setActiveTab('commits')
    expect(useCodeReviewStore.getState().activeTab).toBe('commits')
  })

  it('tracks loading states', () => {
    useCodeReviewStore.getState().setLoading('diff', true)
    expect(useCodeReviewStore.getState().loading.diff).toBe(true)
  })

  it('stores diff data', () => {
    const files = [
      { path: 'src/foo.ts', status: 'modified', additions: 5, deletions: 2, patch: '...' }
    ]
    useCodeReviewStore.getState().setDiffFiles(files)
    expect(useCodeReviewStore.getState().diffFiles).toEqual(files)
  })

  it('stores commits', () => {
    const commits = [{ hash: 'abc', message: 'test', author: 'bot', date: '2026-04-01' }]
    useCodeReviewStore.getState().setCommits(commits)
    expect(useCodeReviewStore.getState().commits).toEqual(commits)
  })

  it('resets all state', () => {
    useCodeReviewStore.getState().selectTask('task-123')
    useCodeReviewStore.getState().reset()
    expect(useCodeReviewStore.getState().selectedTaskId).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/renderer/src/stores/__tests__/codeReview.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the store**

Create `src/renderer/src/stores/codeReview.ts`:

```typescript
import { create } from 'zustand'

export type ReviewTab = 'changes' | 'commits' | 'conversation'

export interface DiffFile {
  path: string
  status: string
  additions: number
  deletions: number
  patch: string
}

export interface ReviewCommit {
  hash: string
  message: string
  author: string
  date: string
}

interface CodeReviewState {
  selectedTaskId: string | null
  activeTab: ReviewTab
  diffFiles: DiffFile[]
  commits: ReviewCommit[]
  loading: Record<string, boolean>
  error: string | null

  selectTask: (taskId: string | null) => void
  setActiveTab: (tab: ReviewTab) => void
  setDiffFiles: (files: DiffFile[]) => void
  setCommits: (commits: ReviewCommit[]) => void
  setLoading: (key: string, loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const initialState = {
  selectedTaskId: null,
  activeTab: 'changes' as ReviewTab,
  diffFiles: [],
  commits: [],
  loading: {},
  error: null
}

export const useCodeReviewStore = create<CodeReviewState>((set) => ({
  ...initialState,
  selectTask: (taskId) => set({ selectedTaskId: taskId, diffFiles: [], commits: [], error: null }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setDiffFiles: (files) => set({ diffFiles: files }),
  setCommits: (commits) => set({ commits }),
  setLoading: (key, loading) => set((s) => ({ loading: { ...s.loading, [key]: loading } })),
  setError: (error) => set({ error }),
  reset: () => set(initialState)
}))
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run src/renderer/src/stores/__tests__/codeReview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/codeReview.ts src/renderer/src/stores/__tests__/codeReview.test.ts
git commit -m "feat: add code review Zustand store"
```

---

## Task 8: Code Review View — Review Queue + Detail Shell

**Files:**

- Modify: `src/renderer/src/views/CodeReviewView.tsx` (replace placeholder)
- Create: `src/renderer/src/components/code-review/ReviewQueue.tsx`
- Create: `src/renderer/src/components/code-review/ReviewDetail.tsx`
- Create: `src/renderer/src/components/code-review/__tests__/ReviewQueue.test.tsx`
- Modify: `src/renderer/src/styles/code-review-neon.css`

- [ ] **Step 1: Build ReviewQueue component**

Create `src/renderer/src/components/code-review/ReviewQueue.tsx`:

```typescript
import { useSprintTaskStore } from '../../stores/sprintTasks'
import { useCodeReviewStore } from '../../stores/codeReview'
import { TASK_STATUS } from '../../../../shared/constants'

export function ReviewQueue() {
  const tasks = useSprintTaskStore(s => s.tasks)
  const selectedTaskId = useCodeReviewStore(s => s.selectedTaskId)
  const selectTask = useCodeReviewStore(s => s.selectTask)

  const reviewTasks = tasks.filter(t => t.status === TASK_STATUS.REVIEW)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  return (
    <aside className="cr-queue">
      <h3 className="cr-queue__title">Review Queue ({reviewTasks.length})</h3>
      <ul className="cr-queue__list">
        {reviewTasks.map(task => (
          <li
            key={task.id}
            className={`cr-queue__item ${task.id === selectedTaskId ? 'cr-queue__item--selected' : ''}`}
            onClick={() => selectTask(task.id)}
          >
            <span className="cr-queue__item-title">{task.title}</span>
            <span className="cr-queue__item-repo">{task.repo}</span>
          </li>
        ))}
        {reviewTasks.length === 0 && (
          <li className="cr-queue__empty">No tasks awaiting review</li>
        )}
      </ul>
    </aside>
  )
}
```

- [ ] **Step 2: Build ReviewDetail shell with tabs**

Create `src/renderer/src/components/code-review/ReviewDetail.tsx`:

```typescript
import { useCodeReviewStore } from '../../stores/codeReview'
import type { ReviewTab } from '../../stores/codeReview'

const TABS: { key: ReviewTab; label: string }[] = [
  { key: 'changes', label: 'Changes' },
  { key: 'commits', label: 'Commits' },
  { key: 'conversation', label: 'Conversation' }
]

export function ReviewDetail() {
  const selectedTaskId = useCodeReviewStore(s => s.selectedTaskId)
  const activeTab = useCodeReviewStore(s => s.activeTab)
  const setActiveTab = useCodeReviewStore(s => s.setActiveTab)

  if (!selectedTaskId) {
    return <div className="cr-detail cr-detail--empty">Select a task to review</div>
  }

  return (
    <div className="cr-detail">
      <div className="cr-detail__tabs" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`cr-detail__tab ${activeTab === tab.key ? 'cr-detail__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="cr-detail__content">
        {activeTab === 'changes' && <div>Changes tab — next task</div>}
        {activeTab === 'commits' && <div>Commits tab — next task</div>}
        {activeTab === 'conversation' && <div>Conversation tab — next task</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire into CodeReviewView**

Update `src/renderer/src/views/CodeReviewView.tsx`:

```typescript
import { ReviewQueue } from '../components/code-review/ReviewQueue'
import { ReviewDetail } from '../components/code-review/ReviewDetail'
import { ReviewActions } from '../components/code-review/ReviewActions'

export default function CodeReviewView() {
  return (
    <div className="cr-view">
      <ReviewQueue />
      <div className="cr-main">
        <ReviewDetail />
        <ReviewActions />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add CSS**

Update `src/renderer/src/styles/code-review-neon.css` with layout styles for the queue sidebar, detail panel, tabs, and action bar. Use `var(--bde-*)` and `var(--neon-*)` tokens. Follow existing BEM patterns (`.cr-queue`, `.cr-detail`, `.cr-actions`).

- [ ] **Step 5: Write tests for ReviewQueue**

Create `src/renderer/src/components/code-review/__tests__/ReviewQueue.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReviewQueue } from '../ReviewQueue'
import { useSprintTaskStore } from '../../../stores/sprintTasks'

describe('ReviewQueue', () => {
  it('shows empty state when no review tasks', () => {
    useSprintTaskStore.setState({ tasks: [] })
    render(<ReviewQueue />)
    expect(screen.getByText(/no tasks awaiting review/i)).toBeInTheDocument()
  })

  it('shows review tasks', () => {
    useSprintTaskStore.setState({
      tasks: [
        { id: '1', title: 'Fix auth', status: 'review', repo: 'bde', updated_at: '2026-04-01' } as any
      ]
    })
    render(<ReviewQueue />)
    expect(screen.getByText('Fix auth')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run tests**

Run: `npm test -- --run src/renderer/src/components/code-review`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/views/CodeReviewView.tsx src/renderer/src/components/code-review/ src/renderer/src/styles/code-review-neon.css
git commit -m "feat: code review view with queue sidebar and detail shell"
```

---

## Task 9: Changes Tab — Diff Viewer Integration

**Files:**

- Create: `src/renderer/src/components/code-review/ChangesTab.tsx`
- Modify: `src/renderer/src/components/code-review/ReviewDetail.tsx`

- [ ] **Step 1: Build ChangesTab component**

Create `src/renderer/src/components/code-review/ChangesTab.tsx`:

This component:

1. Fetches diff data via `window.api.review.getDiff()` when selected task changes
2. Shows a file tree on the left with Added/Modified/Deleted badges
3. Clicking a file fetches per-file diff via `window.api.review.getFileDiff()` and renders using the existing `DiffViewer` component from `src/renderer/src/components/diff/DiffViewer.tsx`

```typescript
import { useEffect, useState } from 'react'
import { useCodeReviewStore } from '../../stores/codeReview'
import { useSprintTaskStore } from '../../stores/sprintTasks'
import { DiffViewer } from '../diff/DiffViewer'
import { useShallow } from 'zustand/react/shallow'

export function ChangesTab() {
  const { selectedTaskId, diffFiles, setDiffFiles, setLoading } = useCodeReviewStore(
    useShallow(s => ({
      selectedTaskId: s.selectedTaskId,
      diffFiles: s.diffFiles,
      setDiffFiles: s.setDiffFiles,
      setLoading: s.setLoading
    }))
  )
  const task = useSprintTaskStore(s => s.tasks.find(t => t.id === selectedTaskId))
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileDiff, setFileDiff] = useState<string>('')

  useEffect(() => {
    if (!task?.worktree_path) return
    setLoading('diff', true)
    window.api.review.getDiff({ worktreePath: task.worktree_path, base: 'main' })
      .then(result => setDiffFiles(result.files))
      .finally(() => setLoading('diff', false))
  }, [task?.worktree_path])

  useEffect(() => {
    if (!task?.worktree_path || !selectedFile) return
    window.api.review.getFileDiff({
      worktreePath: task.worktree_path,
      filePath: selectedFile,
      base: 'main'
    }).then(result => setFileDiff(result.diff))
  }, [selectedFile, task?.worktree_path])

  return (
    <div className="cr-changes">
      <div className="cr-changes__file-list">
        {diffFiles.map(f => (
          <button
            key={f.path}
            className={`cr-changes__file ${f.path === selectedFile ? 'cr-changes__file--selected' : ''}`}
            onClick={() => setSelectedFile(f.path)}
          >
            <span className={`cr-changes__badge cr-changes__badge--${f.status}`}>
              {f.status[0].toUpperCase()}
            </span>
            {f.path}
          </button>
        ))}
      </div>
      <div className="cr-changes__diff">
        {selectedFile ? (
          <DiffViewer diff={fileDiff} filename={selectedFile} />
        ) : (
          <div className="cr-changes__placeholder">Select a file to view changes</div>
        )}
      </div>
    </div>
  )
}
```

**Note:** The implementer must check `DiffViewer`'s actual prop interface — it may expect structured data rather than raw diff string. Adapt accordingly.

- [ ] **Step 2: Wire ChangesTab into ReviewDetail**

In `ReviewDetail.tsx`, replace the changes placeholder:

```typescript
import { ChangesTab } from './ChangesTab'

// In the render:
{activeTab === 'changes' && <ChangesTab />}
```

- [ ] **Step 3: Add CSS for file list and diff layout**

Add to `code-review-neon.css`:

```css
.cr-changes {
  display: flex;
  height: 100%;
}
.cr-changes__file-list {
  width: 260px;
  overflow-y: auto;
  border-right: 1px solid var(--bde-border);
}
.cr-changes__file {
  /* file row styles */
}
.cr-changes__diff {
  flex: 1;
  overflow: auto;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/code-review/ChangesTab.tsx src/renderer/src/components/code-review/ReviewDetail.tsx src/renderer/src/styles/code-review-neon.css
git commit -m "feat: changes tab with file tree and diff viewer"
```

---

## Task 10: Commits Tab + Conversation Tab

**Files:**

- Create: `src/renderer/src/components/code-review/CommitsTab.tsx`
- Create: `src/renderer/src/components/code-review/ConversationTab.tsx`
- Modify: `src/renderer/src/components/code-review/ReviewDetail.tsx`

- [ ] **Step 1: Build CommitsTab**

Fetches commit list via `window.api.review.getCommits()`, displays as a list. Clicking a commit could show its diff (stretch — can use same DiffViewer pattern as ChangesTab).

- [ ] **Step 2: Build ConversationTab**

Shows:

- Task spec/prompt at the top (read from task data)
- Review comments thread (fetch from SQLite via new IPC — or embed in the existing data)
- Revision request input: text area + "Resume Agent" / "Fresh Agent" buttons
- Buttons call `window.api.review.requestRevision()` with mode

- [ ] **Step 3: Wire into ReviewDetail**

Replace the placeholders in ReviewDetail.tsx with the real components.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/code-review/CommitsTab.tsx src/renderer/src/components/code-review/ConversationTab.tsx src/renderer/src/components/code-review/ReviewDetail.tsx
git commit -m "feat: commits tab and conversation tab for code review"
```

---

## Task 11: Review Actions Bar

**Files:**

- Create: `src/renderer/src/components/code-review/ReviewActions.tsx`
- Create: `src/renderer/src/components/code-review/__tests__/ReviewActions.test.tsx`

- [ ] **Step 1: Build ReviewActions component**

Four actions: Merge Locally (primary), Create PR, Request Revision, Discard.

```typescript
import { useState } from 'react'
import { useCodeReviewStore } from '../../stores/codeReview'
import { useConfirm } from '../ui/ConfirmModal'
import { ConfirmModal } from '../ui/ConfirmModal'

export function ReviewActions() {
  const selectedTaskId = useCodeReviewStore(s => s.selectedTaskId)
  const [mergeStrategy, setMergeStrategy] = useState<'squash' | 'merge' | 'rebase'>('squash')
  const { confirm, confirmProps } = useConfirm()

  if (!selectedTaskId) return null

  const handleMerge = async () => {
    const result = await window.api.review.mergeLocally({
      taskId: selectedTaskId, strategy: mergeStrategy
    })
    if (!result.success && result.conflicts) {
      // Show conflict warning in UI
    }
  }

  const handleCreatePr = async () => {
    await window.api.review.createPr({
      taskId: selectedTaskId, title: '', body: ''
    })
  }

  const handleDiscard = async () => {
    const yes = await confirm({
      title: 'Discard Changes',
      message: 'This will delete the worktree and cancel the task. Continue?'
    })
    if (yes) {
      await window.api.review.discard({ taskId: selectedTaskId })
    }
  }

  return (
    <div className="cr-actions">
      <select
        className="cr-actions__strategy"
        value={mergeStrategy}
        onChange={e => setMergeStrategy(e.target.value as 'squash' | 'merge' | 'rebase')}
      >
        <option value="squash">Squash</option>
        <option value="merge">Merge</option>
        <option value="rebase">Rebase</option>
      </select>
      <button className="bde-btn bde-btn--primary" onClick={handleMerge}>
        Merge Locally
      </button>
      <button className="bde-btn bde-btn--secondary" onClick={handleCreatePr}>
        Create PR
      </button>
      <button className="bde-btn bde-btn--ghost" onClick={handleDiscard}>
        Discard
      </button>
      <ConfirmModal {...confirmProps} />
    </div>
  )
}
```

- [ ] **Step 2: Write tests**

Create `src/renderer/src/components/code-review/__tests__/ReviewActions.test.tsx`:

Test: buttons render when task selected, discard shows confirmation, nothing renders when no task selected.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run src/renderer/src/components/code-review`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/code-review/ReviewActions.tsx src/renderer/src/components/code-review/__tests__/ReviewActions.test.tsx
git commit -m "feat: review action bar with merge, PR, and discard controls"
```

---

## Task 12: Integration Testing and Cleanup

**Files:**

- Modify: Various test files referencing `pr-station`
- Verify: All existing tests pass

- [ ] **Step 1: Find and update all `pr-station` references in tests**

Search for `pr-station` across the codebase. Update any test assertions, mock data, or view references to use `'code-review'`.

- [ ] **Step 2: Run full test suite**

Run: `npm test && npm run test:main`
Expected: PASS

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: Verify coverage thresholds**

Run: `npm run test:coverage`
Expected: PASS (72% stmts, 66% branches, 70% functions, 74% lines)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: update tests and references for code review station"
```
