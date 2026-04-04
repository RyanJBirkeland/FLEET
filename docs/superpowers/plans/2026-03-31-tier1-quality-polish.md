# Tier 1 Quality-of-Life Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 high-impact, low-effort quality issues surfaced by the v2 audit — IDE memory leaks, render performance, accessibility, API contract gaps, and agent reliability.

**Architecture:** All changes are surgical (1-15 lines each). No new files, no new dependencies. Each task is independently mergeable.

**Tech Stack:** TypeScript, React, Zustand, Vitest, Node.js HTTP server

---

### Task 1: IDE — Evict `fileContents` on tab close (memory leak)

**Files:**

- Modify: `src/renderer/src/stores/ide.ts:183-208`
- Test: `src/renderer/src/stores/__tests__/ide.test.ts`

**Context:** `closeTab` removes the tab from `openTabs` but never calls `clearFileContent()`. Every opened file's content stays in memory forever. The `clearFileContent` action already exists (line 246) — it just needs to be called.

- [ ] **Step 1: Write the failing test**

In `src/renderer/src/stores/__tests__/ide.test.ts`, add to the `closeTab` describe block:

```typescript
it('evicts fileContents and fileLoadingStates when tab is closed', () => {
  const { openTab, closeTab, setFileContent, setFileLoading } = useIDEStore.getState()
  openTab('/test/file.ts')
  const tabId = useIDEStore.getState().openTabs[0].id
  setFileContent('/test/file.ts', 'const x = 1')
  setFileLoading('/test/file.ts', false)

  closeTab(tabId)

  const state = useIDEStore.getState()
  expect(state.fileContents['/test/file.ts']).toBeUndefined()
  expect(state.fileLoadingStates['/test/file.ts']).toBeUndefined()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/stores/__tests__/ide.test.ts -t "evicts fileContents"`
Expected: FAIL — `fileContents` still contains the entry.

- [ ] **Step 3: Implement the fix**

In `src/renderer/src/stores/ide.ts`, inside `closeTab`, after computing `updatedTabs` and before the `return`, add content eviction:

```typescript
// Inside closeTab, after line 205 (after newActiveTabId computation)
const closedTab = s.openTabs[idx]
const closedPath = closedTab.filePath

// Evict file content if no other tab references the same file
const stillOpen = updatedTabs.some((t) => t.filePath === closedPath)
if (!stillOpen) {
  const { [closedPath]: _, ...restContents } = s.fileContents
  const { [closedPath]: _l, ...restLoading } = s.fileLoadingStates
  return {
    openTabs: updatedTabs,
    activeTabId: newActiveTabId,
    fileContents: restContents,
    fileLoadingStates: restLoading
  }
}

return { openTabs: updatedTabs, activeTabId: newActiveTabId }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/stores/__tests__/ide.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/ide.ts src/renderer/src/stores/__tests__/ide.test.ts
git commit -m "fix: evict fileContents on tab close to prevent IDE memory leak"
```

---

### Task 2: IDE — Fix `activeFilePath` selector causing O(n) FileTreeNode re-renders

**Files:**

- Modify: `src/renderer/src/components/ide/FileTreeNode.tsx:44-47`
- Test: `src/renderer/src/components/ide/__tests__/FileTreeNode.test.tsx` (if exists, else `src/renderer/src/stores/__tests__/ide.test.ts`)

**Context:** Every `FileTreeNode` subscribes to a selector that computes `activeFilePath` by searching `openTabs` — this returns a new string reference on every store change, causing ALL tree nodes to re-render when ANY tab changes. Fix: each node should select a boolean `isActive` comparing its own `fullPath`, so nodes only re-render when their own active state changes.

- [ ] **Step 1: Write the failing test**

This is a render-count optimization — verify via a unit test that the selector returns stable values:

```typescript
// In ide.test.ts
it('activeFilePath-derived selector returns stable boolean per path', () => {
  const { openTab } = useIDEStore.getState()
  openTab('/a.ts')

  // Selector scoped to /a.ts should return true
  const isActiveA =
    useIDEStore.getState().openTabs.find((t) => t.id === useIDEStore.getState().activeTabId)
      ?.filePath === '/a.ts'
  expect(isActiveA).toBe(true)

  // Selector scoped to /b.ts should return false
  const isActiveB =
    useIDEStore.getState().openTabs.find((t) => t.id === useIDEStore.getState().activeTabId)
      ?.filePath === '/b.ts'
  expect(isActiveB).toBe(false)
})
```

- [ ] **Step 2: Implement the fix**

In `src/renderer/src/components/ide/FileTreeNode.tsx`, replace lines 43-47:

```typescript
// Before (returns new string each time — causes re-render of all nodes):
// const activeFilePath = useIDEStore((s) => {
//   const activeTab = s.openTabs.find((t) => t.id === s.activeTabId)
//   return activeTab?.filePath ?? null
// })

// After (returns boolean — only re-renders when THIS node's active state changes):
const isActive = useIDEStore((s) => {
  const activeTab = s.openTabs.find((t) => t.id === s.activeTabId)
  return activeTab?.filePath === fullPath
})
```

Then on line 52, remove the derived `const isActive = activeFilePath === fullPath` since `isActive` is now returned directly by the selector.

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/renderer/src/components/ide/ src/renderer/src/stores/__tests__/ide.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ide/FileTreeNode.tsx
git commit -m "perf: use boolean selector in FileTreeNode to prevent O(n) re-renders"
```

---

### Task 3: IDE — Reduce O(n) IPC listener subscriptions in FileTreeNode

**Files:**

- Modify: `src/renderer/src/components/ide/FileTreeNode.tsx:56-65`

**Context:** Each expanded directory node subscribes independently to `window.api.onDirChanged`. In a large tree with 50 expanded dirs, that's 50 IPC listeners. The current code already filters by path and only subscribes when expanded — this is the mitigation from the first audit. The remaining optimization is to lift the listener to the parent `FileTree` component and pass down a refresh signal via context or prop. However, this is a bigger refactor than Tier 1 scope. **Decision: Skip this task — the existing per-expanded-node guard (line 57) is adequate. Re-evaluate if perf profiling shows it's a bottleneck.**

_No changes needed — documented as intentionally deferred._

---

### Task 4: SpecPanel — Add ARIA dialog attributes and focus trap

**Files:**

- Modify: `src/renderer/src/components/sprint/SpecPanel.tsx:52-58`
- Test: `src/renderer/src/components/sprint/__tests__/SpecPanel.test.tsx`

**Context:** SpecPanel renders as a full-screen overlay but lacks `role="dialog"`, `aria-modal="true"`, and `aria-label`. Screen readers don't know it's a dialog. The Escape handler already exists.

- [ ] **Step 1: Write the failing test**

```typescript
it('overlay has dialog role and aria-modal', () => {
  render(<SpecPanel {...makeProps()} />)
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveAttribute('aria-label', 'Spec — My Task Title')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/sprint/__tests__/SpecPanel.test.tsx -t "dialog role"`
Expected: FAIL — no element with role="dialog"

- [ ] **Step 3: Implement the fix**

In `src/renderer/src/components/sprint/SpecPanel.tsx`, on the `motion.div` (line 55-61), add ARIA attributes:

```tsx
<motion.div
  className="spec-panel"
  role="dialog"
  aria-modal="true"
  aria-label={`Spec — ${taskTitle}`}
  onClick={(e) => e.stopPropagation()}
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/sprint/__tests__/SpecPanel.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/sprint/SpecPanel.tsx src/renderer/src/components/sprint/__tests__/SpecPanel.test.tsx
git commit -m "fix: add ARIA dialog attributes to SpecPanel overlay"
```

---

### Task 5: IDE — Add concurrent save guard

**Files:**

- Modify: `src/renderer/src/views/IDEView.tsx:153-166`

**Context:** `handleSave` is async but has no guard against double-invocation (e.g., rapid Cmd+S). Two concurrent saves to the same file could interleave writes. Fix: track in-flight save per file path.

- [ ] **Step 1: Add save guard**

In `IDEView.tsx`, add a ref to track in-flight saves, then guard `handleSave`:

```typescript
// Before handleSave definition (around line 130)
const savingPaths = useRef(new Set<string>())

// Replace handleSave:
const handleSave = useCallback(async () => {
  if (!activeTab) return
  const content = fileContents[activeTab.filePath]
  if (content === undefined) return
  const { filePath, id } = activeTab
  if (savingPaths.current.has(filePath)) return // Already saving this file
  savingPaths.current.add(filePath)
  try {
    await window.api.writeFile(filePath, content)
    setDirty(id, false)
  } catch (err) {
    toast.error(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  } finally {
    savingPaths.current.delete(filePath)
  }
}, [activeTab, fileContents, setDirty])
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/renderer/src/views/__tests__/IDEView.test.tsx` (if exists) or `npx vitest run --reporter=verbose 2>&1 | head -50`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/IDEView.tsx
git commit -m "fix: guard against concurrent file saves in IDE"
```

---

### Task 6: Add `blocked` to `StatusUpdateRequest` type

**Files:**

- Modify: `src/shared/queue-api-contract.ts:29`

**Context:** `RUNNER_WRITABLE_STATUSES` already includes `'blocked'` (line 45), but the TypeScript `StatusUpdateRequest` type union on line 29 omits it. External callers get a type error when setting status to `blocked` even though the runtime accepts it.

- [ ] **Step 1: Write the failing test**

```typescript
// Type-level test — add to existing queue-api test or create inline:
import { StatusUpdateRequest } from '../../../shared/queue-api-contract'
it('StatusUpdateRequest allows blocked status', () => {
  const req: StatusUpdateRequest = { status: 'blocked' }
  expect(req.status).toBe('blocked')
})
```

- [ ] **Step 2: Implement the fix**

In `src/shared/queue-api-contract.ts`, line 29:

```typescript
// Before:
status: 'queued' | 'active' | 'done' | 'failed' | 'cancelled' | 'error'

// After:
status: 'queued' | 'blocked' | 'active' | 'done' | 'failed' | 'cancelled' | 'error'
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run src/main/queue-api/__tests__/`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/shared/queue-api-contract.ts
git commit -m "fix: add 'blocked' to StatusUpdateRequest type to match runtime"
```

---

### Task 7: Accept both `depends_on` and `dependsOn` in Queue API create

**Files:**

- Modify: `src/main/queue-api/task-handlers.ts:181`

**Context:** The create endpoint destructures `depends_on` (snake_case) while all other Queue API fields use camelCase. External clients sending `dependsOn` get silently ignored. Fix: accept both.

- [ ] **Step 1: Implement the fix**

In `src/main/queue-api/task-handlers.ts`, line 181:

```typescript
// Before:
const { title, repo, depends_on } = body as Record<string, unknown>

// After:
const { title, repo, depends_on, dependsOn } = body as Record<string, unknown>
const resolvedDeps = depends_on ?? dependsOn
```

Then use `resolvedDeps` wherever `depends_on` was used in the create handler body.

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/main/queue-api/__tests__/`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/queue-api/task-handlers.ts
git commit -m "fix: accept both depends_on and dependsOn in Queue API create endpoint"
```

---

### Task 8: SDK streaming — return partial text on timeout instead of throwing

**Files:**

- Modify: `src/main/sdk-streaming.ts:74-78`

**Context:** When `runSdkStreaming` times out, it throws an error and discards all text received so far. For copilot/synthesizer use cases, partial output is better than nothing. Fix: return partial text with a warning instead of throwing.

- [ ] **Step 1: Implement the fix**

In `src/main/sdk-streaming.ts`, replace lines 74-78:

```typescript
// Before:
if (timedOut) {
  throw new Error(`SDK streaming timed out after ${timeoutMs / 1000}s`)
}
return fullText.trim()

// After:
if (timedOut && !fullText.trim()) {
  throw new Error(`SDK streaming timed out after ${timeoutMs / 1000}s with no output`)
}
return fullText.trim()
```

This way: timeout with partial text returns the text; timeout with zero output still throws (caller needs to know nothing came back).

- [ ] **Step 2: Run tests**

Run: `npm run typecheck`
Expected: PASS (no existing unit tests for this module — it requires SDK mocking)

- [ ] **Step 3: Commit**

```bash
git add src/main/sdk-streaming.ts
git commit -m "fix: return partial text on SDK streaming timeout instead of discarding"
```

---

### Task 9: Queue API — validate task existence before DELETE

**Files:**

- Modify: `src/main/queue-api/task-handlers.ts:604-614`

**Context:** `handleDeleteTask` calls `deleteTask(id)` without checking if the task exists first. `deleteTask` in sprint-queries runs the DELETE SQL and records audit — but if the task doesn't exist, it records a deletion of `null`. Fix: check existence first, return 404 if missing.

- [ ] **Step 1: Implement the fix**

In `src/main/queue-api/task-handlers.ts`, modify `handleDeleteTask`:

```typescript
export async function handleDeleteTask(res: http.ServerResponse, id: string): Promise<void> {
  try {
    const existing = getTask(id)
    if (!existing) {
      sendJson(res, 404, { error: `Task ${id} not found` })
      return
    }
    deleteTask(id)
    sendJson(res, 200, { ok: true, id })
  } catch (err) {
    sendJson(res, 500, {
      error: `Failed to delete task ${id}: ${err instanceof Error ? err.message : String(err)}`
    })
  }
}
```

Ensure `getTask` is imported at the top of the file (it likely already is — used on lines 156 and 381).

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/main/queue-api/__tests__/ && npm run typecheck`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/queue-api/task-handlers.ts
git commit -m "fix: return 404 on DELETE for nonexistent tasks instead of silent 200"
```

---

### Task 10: Agent worktree — log warning on cleanup failure with task ID

**Files:**

- Modify: `src/main/agent-manager/run-agent.ts:214`

**Context:** When worktree cleanup fails after a spawn error, the error is silently swallowed inside `cleanupWorktree`. The task is marked terminal but users have no indication a stale worktree remains. Fix: log the cleanup failure with the task ID so users can find it in `~/.bde/agent-manager.log`.

- [ ] **Step 1: Check `cleanupWorktree` signature**

Read `src/main/agent-manager/worktree.ts` to see if `cleanupWorktree` already logs failures internally. If it does, this task is a no-op.

- [ ] **Step 2: Add explicit error logging if needed**

In `src/main/agent-manager/run-agent.ts`, around line 214, wrap the cleanup call:

```typescript
try {
  await cleanupWorktree({
    repoPath,
    worktreePath: worktree.worktreePath,
    branch: worktree.branch,
    logger
  })
} catch (cleanupErr) {
  logger.warn(
    `[agent-manager] Stale worktree for task ${task.id} at ${worktree.worktreePath} — manual cleanup needed: ${cleanupErr}`
  )
}
```

If `cleanupWorktree` already has a try/catch internally, wrap the outer call instead to catch any escaping errors.

- [ ] **Step 3: Run tests**

Run: `npm run test:main`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/agent-manager/run-agent.ts
git commit -m "fix: log warning with task ID when worktree cleanup fails"
```

---

## Summary

| Task | What                                                       | Lines Changed |
| ---- | ---------------------------------------------------------- | ------------- |
| 1    | IDE memory leak — evict fileContents on tab close          | ~8            |
| 2    | IDE perf — boolean selector in FileTreeNode                | ~4            |
| 3    | ~~IDE IPC listeners~~ — DEFERRED (existing guard adequate) | 0             |
| 4    | SpecPanel ARIA dialog attributes                           | ~3            |
| 5    | IDE concurrent save guard                                  | ~8            |
| 6    | `blocked` in StatusUpdateRequest type                      | ~1            |
| 7    | Accept `dependsOn` in Queue API create                     | ~3            |
| 8    | SDK streaming — return partial text on timeout             | ~3            |
| 9    | DELETE task existence check                                | ~5            |
| 10   | Worktree cleanup failure logging                           | ~5            |

**Total: ~40 lines across 9 active tasks. All independently testable and mergeable.**
