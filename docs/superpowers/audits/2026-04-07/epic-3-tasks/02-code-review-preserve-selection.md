# Code Review: preserve selection and advance to next task after actions

## Problem

Every action in `src/renderer/src/components/code-review/ReviewActions.tsx` (Ship It, Merge Locally, Create PR, Revise, Discard, Rebase) runs this pattern:

```ts
if (result.success) {
  toast.success(...)
  selectTask(null)   // ← clears selection
  loadData()         // ← full refetch
}
```

`selectTask(null)` dumps the user back to "No task selected". `loadData()` triggers a full refetch of sprint:list across IPC (~200 rows in 7-day window). The intended Code Review flow — "review task → act → `j` to next → act again" — is broken because the queue's `j`/`k` navigation requires a current selection, and there isn't one after any action. The user has to click the next task manually every time.

Alpha Architect flagged this as MAJOR (`ReviewActions.tsx:72,100,128,174,189,214` all do it); Gamma Senior Dev flagged it as CRITICAL (breaks the high-frequency review loop).

## Solution

After a successful action, **advance to the next `review`-status task in the queue** instead of clearing selection. Only clear selection if there are no more `review` tasks.

In each action handler (`handleShipIt`, `handleMergeLocally`, `handleCreatePr`, `handleRevise`, `handleDiscard`, `handleRebase`), replace the `selectTask(null); loadData()` pair with:

1. Compute the next review task from `useCodeReviewStore`'s `reviewTasks` list (or equivalent): the first task after the currently selected one whose `status === 'review'`. If there are none after the current one, wrap to the first one before. If there are no review tasks at all, set selection to null.
2. Call `selectTask(nextTaskId)` (or `selectTask(null)` if none)
3. Call `loadData()` as before (leave the refetch — it's needed)

The store selector for review tasks is likely already computed for the queue view. If not, derive it inline in the component.

## Files to Change

- `src/renderer/src/components/code-review/ReviewActions.tsx` — update all 6 action handlers (`handleShipIt`, `handleMergeLocally`, `handleCreatePr`, `handleRevise`, `handleDiscard`, `handleRebase`)
- Possibly `src/renderer/src/stores/codeReview.ts` if a helper selector needs to be added

## How to Test

1. `npm run typecheck` — 0 errors
2. `npm run test:coverage` — all tests pass
3. `npm run lint` — 0 errors
4. `npm run test:main` — all tests pass
5. Run specific failing tests in isolation first if you see flakes.
6. Grep check: `grep -n "selectTask(null)" src/renderer/src/components/code-review/ReviewActions.tsx` — should return zero or only the "no-more-tasks" edge case.
7. Any existing tests that assert `selectTask(null)` was called after a successful action must be updated to assert the new advance-to-next behavior.

## Out of Scope

- Changing the polling/refetch logic (leave `loadData()` in place)
- j/k keyboard navigation itself (separate concern)
- Any change to the IPC handlers in `src/main/handlers/review.ts`
- Optimizing `loadData()` to a single-task update
