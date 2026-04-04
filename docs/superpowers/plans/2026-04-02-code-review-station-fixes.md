# Code Review Station — Bug Fixes & Completions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 critical bugs and fill feature gaps in the Code Review Station (PR #607) so the review workflow is production-ready.

**Architecture:** All changes are targeted fixes to existing files — no new modules. Phase 1 fixes the critical handler bugs that break the review lifecycle. Phase 2 adds the missing DB columns/table. Phase 3 improves the UI from minimal to spec-complete.

**Tech Stack:** TypeScript, Electron IPC, SQLite (better-sqlite3), React + Zustand, Vitest

---

## Phase 1 — Critical Handler Bugs (must fix before any reviews land)

### Task 1: Fix `review:createPr` — transition task to `done` after PR creation

The `review:createPr` handler pushes the branch and creates a PR but never transitions the task out of `review`. The task stays in `review` forever. It must mark the task `done` and fire `_onStatusTerminal` for dependency resolution, matching `review:mergeLocally`'s pattern.

**Files:**

- Modify: `src/main/handlers/review.ts:254-311`
- Test: `src/main/handlers/__tests__/review.test.ts`

- [ ] **Step 1: Write failing test**

In `review.test.ts`, add a test that verifies `review:createPr` updates task status to `done` and calls `_onStatusTerminal`:

```typescript
it('review:createPr transitions task to done and fires onStatusTerminal', async () => {
  // Setup: task in review with worktree_path
  // Mock execFileAsync for git push + gh pr create
  // Assert: updateTask called with status: 'done', completed_at set
  // Assert: _onStatusTerminal called with (taskId, 'done')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/handlers/__tests__/review.test.ts --reporter=verbose`
Expected: FAIL — createPr handler doesn't set status to done.

- [ ] **Step 3: Fix the handler**

In `src/main/handlers/review.ts`, after the PR info update (line ~294) and worktree cleanup (line ~308), add the done transition and terminal callback using the same pattern as `review:mergeLocally`. Remove the separate `_updateTask(taskId, { worktree_path: null })` inside the cleanup try-catch since the final update covers it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/handlers/__tests__/review.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/handlers/review.ts src/main/handlers/__tests__/review.test.ts
git commit -m "fix: review:createPr transitions task to done + fires dependency resolution"
```

---

### Task 2: Fix `review:discard` — read branch name BEFORE removing worktree

The handler removes the worktree first (line 358-361), then tries `git rev-parse --abbrev-ref HEAD` in the now-deleted directory (line 368). This always fails silently, leaving orphan branches.

**Files:**

- Modify: `src/main/handlers/review.ts:346-402`
- Test: `src/main/handlers/__tests__/review.test.ts`

- [ ] **Step 1: Write failing test**

Add test that verifies branch name is read before worktree removal, and `git branch -D` is called with the correct branch name.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/handlers/__tests__/review.test.ts --reporter=verbose`

- [ ] **Step 3: Fix the handler**

Reorder: read branch name first, then remove worktree, then delete branch. Follow the pattern used in `review:mergeLocally` (lines 154-159). Read the branch from the worktree path, then remove the worktree, then delete the branch from the repo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/handlers/__tests__/review.test.ts --reporter=verbose`

- [ ] **Step 5: Commit**

```bash
git add src/main/handlers/review.ts src/main/handlers/__tests__/review.test.ts
git commit -m "fix: review:discard reads branch name before removing worktree"
```

---

### Task 3: Fix `review:requestRevision` — document `review → queued` as intentional

The spec says `review → active`, but `queued` is actually the right choice — the agent manager drain loop picks up `queued` tasks, not `active` ones (active means agent is running). Since there's no code-level `VALID_TRANSITIONS` map (only the SQLite CHECK constraint, which already accepts both), the fix is a spec update + test coverage.

**Files:**

- Modify: `docs/superpowers/specs/2026-04-01-code-review-station-design.md` (spec update)
- Test: `src/main/handlers/__tests__/review.test.ts` (test that requestRevision sets queued + clears claimed_by)

- [ ] **Step 1: Write test confirming current behavior is correct**

```typescript
it('review:requestRevision transitions to queued with feedback appended to spec', async () => {
  // Assert status set to 'queued', claimed_by null, spec includes revision feedback
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/main/handlers/__tests__/review.test.ts --reporter=verbose`
Expected: PASS (current behavior is correct, just undocumented)

- [ ] **Step 3: Update the spec**

In `docs/superpowers/specs/2026-04-01-code-review-station-design.md`, update the valid transitions to: `review: ['done', 'queued', 'cancelled']`. Update the session resumption section to reflect that revision goes through `queued` (drain loop claims it) rather than directly to `active`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-01-code-review-station-design.md src/main/handlers/__tests__/review.test.ts
git commit -m "fix: document review→queued transition as intentional design choice"
```

---

### Task 4: Fix `review:getCommits` — use safe delimiter for commit parsing

Commit messages containing `|` break the parser at line 121. Use `%x00` (null byte) as separator.

**Files:**

- Modify: `src/main/handlers/review.ts:107-126`
- Test: `src/main/handlers/__tests__/review.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it('review:getCommits parses commit messages containing pipe characters', async () => {
  // Mock git log output with | in a commit message
  // Assert message is not truncated
})
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Fix the parser**

Change the git log format to use `%x00` (null byte) as separator instead of `|`:

```typescript
['log', `${base}..HEAD`, '--format=%H%x00%s%x00%an%x00%aI', '--reverse'],
// ...
.map((line) => {
  const [hash, message, author, date] = line.split('\x00')
  return { hash, message, author, date }
})
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add src/main/handlers/review.ts src/main/handlers/__tests__/review.test.ts
git commit -m "fix: review:getCommits uses null-byte separator to handle pipes in commit messages"
```

---

## Phase 2 — Missing DB Schema

### Task 5: Add `session_id` column and `review_comments` table (migration v22)

The spec calls for `session_id TEXT NULL` on `sprint_tasks` for session resumption, and a `review_comments` table for inline comments. Neither exists.

**Files:**

- Modify: `src/main/db.ts` (add migration v22)
- Modify: `src/main/data/sprint-queries.ts` (add `session_id` to `UPDATE_ALLOWLIST`)
- Modify: `CLAUDE.md` (update sprint_tasks column list)
- Test: `src/main/__tests__/integration/sprint-crud.test.ts` (verify migration runs)

- [ ] **Step 1: Write the migration**

In `src/main/db.ts`, add after the v21 migration entry:

```typescript
{
  version: 22,
  description: 'Add session_id column to sprint_tasks and review_comments table',
  up: (db) => {
    const cols = (db.pragma('table_info(sprint_tasks)') as { name: string }[]).map((c) => c.name)
    if (!cols.includes('session_id')) {
      db.exec('ALTER TABLE sprint_tasks ADD COLUMN session_id TEXT')
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS review_comments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        task_id TEXT NOT NULL,
        file_path TEXT,
        line_number INTEGER,
        body TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT 'user',
        revision_number INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_review_comments_task_id ON review_comments(task_id);
    `)
  }
}
```

- [ ] **Step 2: Add `session_id` to `UPDATE_ALLOWLIST`**

In `src/main/data/sprint-queries.ts`, add `'session_id'` to the `UPDATE_ALLOWLIST` set.

- [ ] **Step 3: Update `sprint_tasks full column list` in CLAUDE.md**

Add `worktree_path, session_id` to the column list gotcha.

- [ ] **Step 4: Run tests**

Run: `npm run test:main`
Expected: PASS — migration applies cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/main/db.ts src/main/data/sprint-queries.ts CLAUDE.md
git commit -m "feat: add session_id column and review_comments table (migration v22)"
```

---

### Task 6: Add `review` to supabase-import VALID_STATUSES

**Files:**

- Modify: `src/main/data/supabase-import.ts:133`

- [ ] **Step 1: Add `'review'` to the VALID_STATUSES set**

At line 133, add `'review'` to the set alongside the other statuses.

- [ ] **Step 2: Commit**

```bash
git add src/main/data/supabase-import.ts
git commit -m "fix: add review to supabase-import VALID_STATUSES"
```

---

## Phase 3 — Documentation Updates

### Task 7: Update CLAUDE.md with Code Review Station documentation

CLAUDE.md still describes the old PR Station flow and doesn't mention the `review` status, Code Review view, or the new IPC handlers. BDE_FEATURES.md still describes PR Station as the review surface.

**Files:**

- Modify: `CLAUDE.md`
- Modify: `docs/BDE_FEATURES.md`

- [ ] **Step 1: Update CLAUDE.md**

Key sections to update:

1. **Architecture Notes** — Add Code Review section describing the view, IPC handlers (`src/main/handlers/review.ts`), and review lifecycle (agent completes → review → merge locally / create PR / revise / discard). Update agent completion description to say it now stops at `review` instead of pushing PR.

2. **Task statuses gotcha** — Add `review` to the status list: `backlog, queued, blocked, active, review, done, cancelled, failed, error`.

3. **Key File Locations** — Add review handler, code review store, and code review components.

4. **Views** — Change `PR Station (⌘5)` to `Code Review (⌘5)`.

5. **Sprint partition buckets** — Update to include `review` mapped to `awaitingReview`.

6. **Gotchas** — Add notes about review:createPr marking done, review:requestRevision going to queued, and review worktree preservation.

7. **sprint_tasks full column list** — Add `worktree_path, session_id`.

- [ ] **Step 2: Update BDE_FEATURES.md**

1. **How Work Flows Through BDE** — Step 4 should describe local code review instead of PR creation.
2. **Code Review section** — Replace PR Station description with Code Review Station (review queue, tabs, actions).
3. **Task statuses** — Add `review` between `active` and `done`.
4. **Sprint Pipeline partitions** — Show `review` maps to `awaitingReview`.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/BDE_FEATURES.md
git commit -m "docs: update CLAUDE.md and BDE_FEATURES.md for Code Review Station"
```

---

## Phase 4 — UI Improvements (parallel-safe, independent tasks)

### Task 8: Replace hardcoded `base: 'main'` with `origin/main`

ChangesTab and CommitsTab hardcode `base: 'main'`. Since agent worktrees branch from `origin/main`, this is the correct base for diffing.

**Files:**

- Modify: `src/renderer/src/components/code-review/ChangesTab.tsx:24,40`
- Modify: `src/renderer/src/components/code-review/CommitsTab.tsx:20`

- [ ] **Step 1: Update both files**

Replace `base: 'main'` with `base: 'origin/main'` in both ChangesTab and CommitsTab.

- [ ] **Step 2: Run tests**

Run: `npm test`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/code-review/ChangesTab.tsx src/renderer/src/components/code-review/CommitsTab.tsx
git commit -m "fix: use origin/main as base branch in review diff/commits"
```

---

### Task 9: Remove dead PR Station components

PR Station view and its components are unreachable now that the view registry points to `code-review`. Clean up dead code.

**Files:**

- Check: `src/renderer/src/views/PRStationView.tsx` (delete if exists and unreferenced)
- Check: `src/renderer/src/components/pr-station/` — grep for imports, keep anything still referenced, delete the rest
- Check: `src/renderer/src/styles/pr-station-neon.css` — remove import from `main.css` if no longer used

- [ ] **Step 1: Grep for pr-station imports**

Find all files that import from `pr-station/` or reference `PRStation`. Keep anything still imported by active code. Delete the rest.

- [ ] **Step 2: Remove dead files**

- [ ] **Step 3: Remove CSS import from main.css if dead**

- [ ] **Step 4: Run typecheck + tests**

Run: `npm run typecheck && npm test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove dead PR Station components replaced by Code Review"
```

---

## Summary

| Phase             | Tasks      | Priority     | Can parallelize?          |
| ----------------- | ---------- | ------------ | ------------------------- |
| 1 — Critical Bugs | 1, 2, 3, 4 | Must fix     | Tasks 1-4 are independent |
| 2 — DB Schema     | 5, 6       | Should fix   | Task 6 independent of 5   |
| 3 — Docs          | 7          | Should fix   | Independent               |
| 4 — UI Polish     | 8, 9       | Nice to have | Tasks 8, 9 independent    |

**Parallelization strategy:** Tasks 1-4 touch different sections of `review.ts` so they can run as parallel agents if each handles merge conflicts carefully. Tasks 5-6 are DB-layer. Task 7 is docs-only. Tasks 8-9 are renderer-only. All 4 phases can run in parallel with careful conflict resolution, or sequentially for safety.
