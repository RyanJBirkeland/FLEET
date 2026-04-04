# Code Review Station — Design Spec

**Date:** 2026-04-01
**Status:** Draft
**Replaces:** PR Station (as primary review surface)

## Summary

Replace the PR-based review step in BDE's agent pipeline with a local **Code Review** view. When an agent finishes work, instead of immediately pushing a branch and opening a GitHub PR, it posts its changes to a review board. The user reviews diffs, commit history, and can request revisions (resume or fresh agent). Once satisfied, they choose "Merge locally" (default) or "Create PR."

This decouples the review workflow from GitHub, letting BDE be useful in environments where PRs aren't practical for every change.

## Motivation

- Using BDE at work where creating a PR for every agent-generated change is impractical
- Review quality improves when there's a gate between "agent finished" and "code lands"
- Local merge option gives flexibility — PR only when it makes sense

## Pipeline State Machine Change

### Current Flow

```
queued → active → [push + open PR] → done
```

### New Flow

```
queued → active → review → done
```

### New Status: `review`

Added to `TaskStatus` union in `src/shared/types.ts` and `TASK_STATUS` object in `src/shared/constants.ts` (as `REVIEW: 'review'`).

**Valid transitions from `review`:**

| Transition           | Trigger                                     | What Happens                                         |
| -------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `review → done`      | User approves (merge locally or PR created) | Worktree cleaned up, dependency resolution fires     |
| `review → active`    | User requests revision                      | Agent resumes or fresh agent spawns in same worktree |
| `review → cancelled` | User discards work                          | Worktree cleaned up, dependency resolution fires     |

**Valid transitions to `review`:**

| Transition        | Trigger                      |
| ----------------- | ---------------------------- |
| `active → review` | Agent completes successfully |

### Contract Changes

**`src/shared/types.ts`** — Add `'review'` to `TaskStatus` union:

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

**`src/shared/constants.ts`** — Add `REVIEW: 'review'` to the `TASK_STATUS` constant object. Also add `'review'` to `RUNNER_WRITABLE_STATUSES` in `src/shared/queue-api-contract.ts` so the Queue API accepts it.

**`src/shared/ipc-channels.ts`** — Add `ReviewChannels` interface with all 6 new handler signatures, composite into `IpcChannelMap` (follows existing pattern: `SprintChannels`, `WorkbenchChannels`, etc.).

**`VALID_TRANSITIONS`** — Update transition map:

```typescript
active: ['review', 'done', 'failed', 'error', 'cancelled'],
review: ['done', 'active', 'cancelled'],
```

**`TERMINAL_STATUSES`** in `task-terminal-service.ts` — unchanged (`done`, `failed`, `error`, `cancelled`). `review` is NOT terminal — the worktree stays alive and dependencies don't resolve yet.

**`partitionSprintTasks()`** in sprint tasks store — add `review` bucket (or map to an existing UI partition like `awaitingReview`). The `awaitingReview` partition currently catches `active`/`done` with `pr_status=open` — this logic changes: `review` status tasks go here directly, no PR status check needed.

### Queue API

- `PATCH /queue/tasks/:id/status` accepts `review` as a valid status
- External callers (task-runner, chat-service) can transition tasks to `review`
- No new endpoints needed

## Agent Completion Change

### Current Behavior (`src/main/agent-manager/completion.ts`)

On success: `resolveSuccess` pushes the branch, runs `gh pr create`, and sets `pr_url`/`pr_number`/`pr_status` on the task — but does NOT mark the task `done`. The task stays `active` with `pr_status=open`. The Sprint PR Poller then detects when the PR is merged or closed and transitions the task to `done` or `cancelled` via `TaskTerminalService`.

### New Behavior

On success: **do NOT push or create PR**. Instead:

1. Set task status to `review`
2. Store the worktree path on the task record (new field: `worktree_path`)
3. Emit an event so the renderer knows a review is ready
4. **Keep the worktree alive** — do NOT clean up

The push + PR creation moves to the Code Review view's "Create PR" action. Local merge also happens from the review view.

### New Task Fields

Add to `sprint_tasks` table (new migration):

| Column          | Type      | Purpose                                           |
| --------------- | --------- | ------------------------------------------------- |
| `worktree_path` | TEXT NULL | Path to agent's worktree while in `review` status |

This field is set when status transitions to `review` and cleared when the review is resolved (merged, PR'd, or cancelled).

### Worktree Lifetime Management

Today, `run-agent.ts` unconditionally cleans up the worktree after agent completion. This must change:

- **On agent success:** Skip worktree cleanup. Set `worktree_path` on the task and transition to `review`.
- **On agent failure:** Clean up worktree as before (no review for failed work).
- **Stale worktree protection:** `pruneStaleWorktrees()` in `worktree.ts` must check task status — do NOT prune worktrees for tasks in `review` status. Add a query: if a worktree path matches a task with `status='review'`, skip it.
- **App crash recovery:** On startup, scan for tasks with `status='review'` and verify their `worktree_path` still exists. If the worktree is missing (crash, manual deletion), set a warning flag on the task so the UI shows "worktree lost — discard or recreate."
- **Disk space:** No automatic timeout. The review queue UI shows time-in-review per task. Users manage their own queue.

### Session Resumption for Revisions

To support "Resume Agent" (sending the same agent back with feedback):

- **New field:** Add `session_id TEXT NULL` to `sprint_tasks` (same migration). Set by `run-agent.ts` when the SDK session starts. Cleared on task completion (done/cancelled/failed).
- **Resume flow:** `review:requestRevision` with `mode='resume'` reads `session_id` from the task, transitions to `active`, and signals the agent manager to re-claim with `resume: sessionId` + the user's feedback appended to the prompt.
- **Fresh flow:** `mode='fresh'` spawns a new agent in the same worktree with the original spec + a diff summary + the user's feedback. No session resumption.
- **Agent manager drain loop:** Add a check — when a task enters `active` from `review`, the agent manager sees it as claimable but must check for `session_id` (resume) vs. null (fresh). The `claimed_by` field is re-set on claim as usual.

### Merge Strategy and Conflict Handling

**Default strategy:** Squash merge (cherry-pick with `--squash` equivalent — apply all changes as a single commit on the target branch).

**Available strategies:**

- **Squash** (default): `git merge --squash <branch>` in the main repo checkout, then auto-commit with the task title as message.
- **Merge commit**: `git merge --no-ff <branch>` — preserves full commit history.
- **Rebase**: `git rebase <branch>` — linear history.

**Conflict handling:** If the merge/rebase has conflicts:

1. The IPC handler returns `{ success: false, conflicts: string[] }` listing conflicted files.
2. The UI shows a conflict warning with the file list.
3. User can: (a) request a revision to have the agent rebase, (b) resolve manually in the IDE, or (c) discard.
4. No partial merge state is left — on conflict, the merge is aborted (`git merge --abort`).

**Target branch:** Always merges onto the branch that `main` repo checkout is on (per CLAUDE.md, this is always `main`).

## Code Review View

### Replaces PR Station

- View key: `code-review` (replaces `pr-station`)
- Shortcut: `⌘5` (same slot)
- Icon: `GitCompareArrows` or `CodeXml` from lucide-react
- Label: "Code Review"

### View Registry Update

In `src/renderer/src/lib/view-registry.ts`:

```typescript
'code-review': { label: 'Code Review', icon: GitCompareArrows, shortcut: '⌘5', shortcutKey: '5' }
```

Remove `pr-station` entry. Update `view-resolver.tsx` lazy import.

### Layout

**Left panel — Review Queue:**

- List of tasks with status `review`, sorted by most recent (when they entered review)
- Each item shows: task title, repo name, time in review, agent run count
- Click to select and show details in the main panel

**Main panel — Review Detail (3 tabs):**

1. **Changes tab** (default)
   - File tree showing all changed files with status badges (Added/Modified/Deleted)
   - Click a file → side-by-side diff viewer (reuse existing diff components from PR Station)
   - Inline comment support — comments stored in SQLite `review_comments` table

2. **Commits tab**
   - Commit history for the agent's branch (relative to base branch)
   - Click a commit to see its individual diff

3. **Conversation tab**
   - Shows agent's original task spec/prompt
   - Review comments thread
   - Revision history (if agent was sent back for changes)
   - Input for requesting a revision — text field + "Resume Agent" / "Fresh Agent" buttons

**Bottom bar — Actions:**

| Action                               | Behavior                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Merge Locally** (primary, default) | Cherry-pick or merge agent's commits onto target branch locally. Clean up worktree. Mark task `done`.                         |
| **Create PR**                        | Push branch to remote, open PR via `gh pr create`, set `pr_url`/`pr_number`/`pr_status`. Clean up worktree. Mark task `done`. |
| **Request Revision**                 | Transition task back to `active`. Agent resumes (same session) or fresh agent spawns.                                         |
| **Discard**                          | Clean up worktree. Mark task `cancelled`. Confirmation dialog required.                                                       |

### Diff Viewer

Reuse the existing diff rendering from PR Station (`src/renderer/src/components/diff/`). The data source changes from GitHub API responses to local git commands:

- `git diff main...<branch>` for full diff
- `git log main..<branch> --oneline` for commit list
- `git diff <commit>^..<commit>` for per-commit diffs

These git commands run via new IPC handlers (see below).

## New IPC Handlers

### `review:getDiff`

```typescript
safeHandle('review:getDiff', async ({ worktreePath, base }) => {
  // git diff base...HEAD in the worktree
  return { files: DiffFile[] }
})
```

### `review:getCommits`

```typescript
safeHandle('review:getCommits', async ({ worktreePath, base }) => {
  // git log base..HEAD in the worktree
  return { commits: Commit[] }
})
```

### `review:getFileDiff`

```typescript
safeHandle('review:getFileDiff', async ({ worktreePath, filePath, base }) => {
  // git diff base...HEAD -- <filePath>
  return { diff: string }
})
```

### `review:mergeLocally`

```typescript
safeHandle('review:mergeLocally', async ({ taskId, strategy }) => {
  // 1. Get task's worktree_path and branch
  // 2. In the main repo, merge or cherry-pick the branch
  // 3. Clean up worktree
  // 4. Clear worktree_path on task
  // 5. Mark task done via TaskTerminalService
  return { success: boolean }
})
```

### `review:createPr`

```typescript
safeHandle('review:createPr', async ({ taskId, title, body }) => {
  // 1. Push branch from worktree
  // 2. gh pr create
  // 3. Set pr_url, pr_number, pr_status on task
  // 4. Clean up worktree
  // 5. Mark task done via TaskTerminalService
  return { prUrl: string }
})
```

### `review:requestRevision`

```typescript
safeHandle('review:requestRevision', async ({ taskId, feedback, mode }) => {
  // mode: 'resume' | 'fresh'
  // 1. Store feedback as a review comment
  // 2. Transition task back to active
  // 3. If resume: re-spawn agent with same sessionId + feedback
  // 4. If fresh: spawn new agent with original spec + diff context + feedback
  return { success: boolean }
})
```

### `review:discard`

```typescript
safeHandle('review:discard', async ({ taskId }) => {
  // 1. Clean up worktree
  // 2. Clear worktree_path
  // 3. Mark task cancelled via TaskTerminalService
  return { success: boolean }
})
```

Register all in `src/main/handlers/review.ts` → `registerReviewHandlers()` → wire in `src/main/index.ts`.

Update `src/preload/index.ts` and `src/preload/index.d.ts` with the new `review` namespace.

## Data Model

### `review_comments` Table (New Migration)

```sql
CREATE TABLE review_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES sprint_tasks(id),
  file_path TEXT,          -- NULL for general comments
  line_number INTEGER,     -- NULL for file-level or general comments
  body TEXT NOT NULL,
  author TEXT NOT NULL,     -- 'user' or 'agent'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  revision_number INTEGER NOT NULL DEFAULT 1
);
```

### Migration

New migration entry in the migrations array (next version after current latest). Adds:

- `worktree_path TEXT NULL` column to `sprint_tasks`
- `session_id TEXT NULL` column to `sprint_tasks`
- `review_comments` table

## Sprint Pipeline Integration

### Pipeline View Partitions

Update `partitionSprintTasks()` to handle the `review` status:

- Tasks with status `review` go into the `awaitingReview` bucket
- Remove the old `awaitingReview` logic that checks `pr_status=open` on active/done tasks (this was a proxy — now we have a real status)

### Pipeline Stage Visual

The Sprint Pipeline view should show `review` as a visible stage between `active` and `done` in the pipeline flow visualization.

## PR Station Removal

PR Station view (`pr-station`) is removed as a view. The components worth preserving:

- **Keep:** `src/renderer/src/components/diff/` — diff rendering components, reused by Code Review
- **Keep:** `src/renderer/src/components/pr-station/` components that handle diff display
- **Remove:** GitHub-specific PR list, PR detail fetching, CI status polling, merge controls tied to GitHub API
- **Remove or repurpose:** Sprint PR Poller (`pr-poller.ts`) — if tasks can still have PRs (via "Create PR" action), the poller should still track those PRs to completion. Keep it but make it only poll tasks that have `pr_url` set.

### PR Poller Adjustment

The Sprint PR Poller currently watches tasks with `pr_status=open`. This still works — when a user clicks "Create PR" from the review view, the task gets `pr_url`/`pr_status` set and the poller picks it up. The poller just no longer drives the primary review workflow.

## Events

When a task transitions to `review`, the main process broadcasts:

```typescript
broadcast('sprint:taskUpdated', { task }) // existing channel, existing pattern
```

No new event channel needed — the renderer's sprint tasks store already subscribes to `sprint:taskUpdated` and will pick up the status change. The Code Review view filters for `status === 'review'` from the store.

## Cross-Repo Impact

Per CLAUDE.md, `claude-task-runner/shared/contract.ts` is the canonical source for `TaskStatus`. Adding `review` to BDE means:

- **claude-task-runner:** Add `'review'` to `TaskStatus` union and `VALID_TRANSITIONS`. The runner itself won't transition tasks to `review` (only agents do), but it needs to understand the status for display/filtering.
- **claude-chat-service:** Same — add to its copy of the type. Sprint MCP tools should recognize `review` as a valid status.
- **Life OS:** Read-only consumer. Will see `review` tasks in the pipeline. No code change needed if it handles unknown statuses gracefully (it should).

These updates are coordination tasks, not blockers for BDE implementation.

## Migration Path

This is a breaking change to the pipeline flow. Migration considerations:

- **Existing `active` tasks:** If an agent completes while old code is running, it goes straight to `done` (old behavior). After update, new completions go to `review`. No migration needed for in-flight tasks.
- **Existing PR Station layouts:** Users with `pr-station` in their saved panel layout will get a fallback to `code-review`. Handle in layout restoration logic — if view key not found in registry, substitute `code-review` for `pr-station`.

## Summary of Files Changed

### New Files

- `src/main/handlers/review.ts` — Review IPC handlers
- `src/renderer/src/views/CodeReviewView.tsx` — Main view component
- `src/renderer/src/components/code-review/` — Review queue, detail panel, action bar
- `src/renderer/src/stores/codeReview.ts` — Zustand store for review state
- `src/renderer/src/styles/code-review.css` — View-specific styles
- Tests for all new modules

### Modified Files

- `src/shared/types.ts` — Add `review` to TaskStatus
- `src/shared/constants.ts` — Add to VALID_STATUSES
- `src/main/agent-manager/completion.ts` — Stop at `review` instead of pushing PR
- `src/main/services/task-terminal-service.ts` — No change (review is not terminal)
- `src/main/data/migrations.ts` — New migration for `worktree_path` + `review_comments`
- `src/main/index.ts` — Register review handlers
- `src/preload/index.ts` + `index.d.ts` — Add review bridge methods
- `src/renderer/src/lib/view-registry.ts` — Replace pr-station with code-review
- `src/renderer/src/lib/view-resolver.tsx` — Update lazy import
- `src/renderer/src/stores/sprintTasks.ts` — Update partition logic
- `src/renderer/src/stores/panelLayout.ts` — Update `View` type union: replace `'pr-station'` with `'code-review'`
- `src/renderer/src/components/layout/NeonSidebar.tsx` — Update if view-specific references exist
- `src/renderer/src/components/layout/CommandPalette.tsx` — Same
- `src/renderer/src/styles/main.css` — Import code-review.css
- `src/shared/ipc-channels.ts` — Add `ReviewChannels` interface to `IpcChannelMap`
- `src/shared/queue-api-contract.ts` — Add `'review'` to `RUNNER_WRITABLE_STATUSES`
- `src/main/data/supabase-import.ts` — Add `'review'` to local `VALID_STATUSES` set
- `src/main/agent-manager/run-agent.ts` — Skip worktree cleanup on success, set `session_id`
- `src/main/agent-manager/worktree.ts` — `pruneStaleWorktrees()` skips review-status worktrees
- Handler count test — Update `safeHandle()` call count assertion (+6)

### Removed/Deprecated

- `src/renderer/src/views/PRStationView.tsx` — Replaced by CodeReviewView
- PR-specific components that aren't reused by Code Review
- GitHub PR fetching logic (keep diff components)
