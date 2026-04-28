## 1. T-51 — Replace raw setInterval in PipelineHeader with useBackoffInterval

- [x] 1.1 In `src/renderer/src/components/sprint/PipelineHeader.tsx`, add `useCallback` to the React import alongside the existing `useState` and `useEffect`.
- [x] 1.2 Remove the `useEffect` block at line 68–83 (the one that calls `setInterval(() => void fetchStatus(), 5000)`).
- [x] 1.3 Define a stable `fetchStatus` callback using `useCallback`:
  ```ts
  const fetchStatus = useCallback(async (): Promise<void> => {
    try {
      const status = await window.api.agentManager.status()
      setWipSlots({
        active: status.concurrency.activeCount,
        max: status.concurrency.maxSlots
      })
    } catch {
      // agent manager may not be running — badge stays hidden
    }
  }, [])
  ```
- [x] 1.4 Add the import for `useBackoffInterval`: `import { useBackoffInterval } from '../../hooks/useBackoffInterval'`
- [x] 1.5 Call `useBackoffInterval(fetchStatus, 5000)` at the top level of the component, after the `fetchStatus` definition. No options object needed — defaults (maxMs = 5×base, jitter = 10%, backoffFactor = 2) are appropriate.
- [x] 1.6 Run `npm run typecheck` — must pass with zero errors.
- [x] 1.7 Run `npm test` — must pass.

## 2. T-53 — Replace full-sort merge with two-pointer ordered merge in agentEvents

- [x] 2.1 In `src/renderer/src/stores/agentEvents.ts`, replace the body of `mergeHistoryWithLiveEvents` (lines 24–33) with the two-pointer implementation:
  ```ts
  function mergeHistoryWithLiveEvents(history: AgentEvent[], live: AgentEvent[]): AgentEvent[] {
    const result: AgentEvent[] = []
    const seen = new Set<string>()
    let h = 0
    let l = 0

    function appendIfNew(event: AgentEvent): void {
      const key = dedupKey(event)
      if (!seen.has(key)) {
        seen.add(key)
        result.push(event)
      }
    }

    while (h < history.length && l < live.length) {
      if (history[h].timestamp <= live[l].timestamp) {
        appendIfNew(history[h++])
      } else {
        appendIfNew(live[l++])
      }
    }
    while (h < history.length) appendIfNew(history[h++])
    while (l < live.length) appendIfNew(live[l++])

    return result
  }
  ```
- [x] 2.2 Update the JSDoc above `mergeHistoryWithLiveEvents` to note that both inputs must be pre-sorted by `timestamp` ascending (the invariant the two-pointer merge relies on). Remove the sentence about `Array.prototype.sort` being stable — it is no longer relevant.
- [x] 2.3 Create `src/renderer/src/stores/__tests__/agentEvents.test.ts`. Import `mergeHistoryWithLiveEvents` — since it is not exported, either export it with `export` (preferred for testability) or test it indirectly through `loadHistory`. Prefer direct export.
- [x] 2.4 Add test: "merges two ordered arrays, preserving chronological order" — pass history `[{timestamp:1,...}, {timestamp:3,...}]` and live `[{timestamp:2,...}, {timestamp:4,...}]`; assert result timestamps are `[1, 2, 3, 4]`.
- [x] 2.5 Add test: "deduplicates events with the same dedup key" — pass the same `agent:started` event (same `timestamp` + `model`) in both history and live; assert result contains it exactly once.
- [x] 2.6 Add test: "appends live-only events that are newer than all history" — pass history `[{timestamp:1}]` and live `[{timestamp:1}, {timestamp:5}]`; assert result length is 2 and last timestamp is 5.
- [x] 2.7 If `mergeHistoryWithLiveEvents` was exported to enable step 2.3, update any existing imports of the file to confirm nothing breaks.
- [x] 2.8 Run `npm run typecheck` — must pass.
- [x] 2.9 Run `npm test` — all three new tests must pass.

## 3. T-54 — Extract withoutPendingUpdate helper in sprintTasks

- [x] 3.1 In `src/renderer/src/stores/sprintTasks.ts`, add the following module-level helper directly above the `useSprintTasks = create(...)` call:
  ```ts
  function withoutPendingUpdate(
    pendingUpdates: PendingUpdates,
    taskId: string,
    shouldClear: boolean
  ): PendingUpdates {
    if (!shouldClear) return pendingUpdates
    const { [taskId]: _, ...rest } = pendingUpdates
    return rest
  }
  ```
- [x] 3.2 In the success path of `updateTask` (around line 244), replace the IIFE:
  ```ts
  // Before
  pendingUpdates: shouldClear
    ? (() => {
        const { [taskId]: _, ...rest } = state.pendingUpdates
        return rest
      })()
    : state.pendingUpdates,
  // After
  pendingUpdates: withoutPendingUpdate(state.pendingUpdates, taskId, shouldClear),
  ```
- [x] 3.3 In the error path of `updateTask` (around line 266), apply the same replacement:
  ```ts
  pendingUpdates: withoutPendingUpdate(state.pendingUpdates, taskId, shouldClear),
  ```
- [x] 3.4 Run `npm run typecheck` — must pass.
- [x] 3.5 Run `npm test` — existing `updateTask` tests must continue to pass.

## 4. T-55 — Decompose loadData into named sub-functions

- [x] 4.1 In `src/renderer/src/stores/sprintTasks.ts`, add the following module-level helper functions above `useSprintTasks`:
  ```ts
  function sanitizeIncomingTasks(raw: unknown[]): SprintTask[] {
    return (Array.isArray(raw) ? raw : []).map((t) => ({
      ...(t as SprintTask),
      depends_on: sanitizeDependsOn((t as SprintTask).depends_on)
    }))
  }

  function buildFingerprint(tasks: SprintTask[]): string {
    return tasks
      .map((task) => `${task.id}:${task.updated_at}`)
      .sort()
      .join('|')
  }

  function hasNoPendingOps(state: { pendingUpdates: PendingUpdates; pendingCreates: string[] }): boolean {
    return Object.keys(state.pendingUpdates).length === 0 && state.pendingCreates.length === 0
  }

  function mergeTasksWithPendingState(
    incoming: SprintTask[],
    state: { tasks: SprintTask[]; pendingUpdates: PendingUpdates; pendingCreates: string[] },
    now: number
  ): { tasks: SprintTask[]; pendingUpdates: PendingUpdates } {
    const nextPending = expirePendingUpdates(state.pendingUpdates, PENDING_UPDATE_TTL)
    // Only built when merge is needed — callers must not invoke this on no-change poll cycles
    const currentTaskMap = new Map(state.tasks.map((task) => [task.id, task]))

    const mergedById = new Map<string, SprintTask>()
    for (const task of incoming) {
      const merged = mergePendingFields(
        task,
        currentTaskMap.get(task.id),
        nextPending[task.id],
        now,
        PENDING_UPDATE_TTL
      )
      mergedById.set(task.id, stableTaskRef(merged, currentTaskMap.get(task.id)))
    }

    for (const tempId of state.pendingCreates) {
      if (!mergedById.has(tempId)) {
        const tempTask = currentTaskMap.get(tempId)
        if (tempTask) mergedById.set(tempId, tempTask)
      }
    }

    return {
      tasks: Array.from(mergedById.values()),
      pendingUpdates: nextPending
    }
  }
  ```
- [x] 4.2 Replace the body of `loadData` in the store with:
  ```ts
  loadData: async (): Promise<void> => {
    set({ loadError: null, pollError: null, loading: true })
    try {
      const incoming = sanitizeIncomingTasks(await listTasks())
      const currentState = get()

      if (buildFingerprint(currentState.tasks) === buildFingerprint(incoming) && hasNoPendingOps(currentState)) {
        set({ loading: false })
        return
      }

      set((state) => mergeTasksWithPendingState(incoming, state, Date.now()))
    } catch (e) {
      const message = 'Failed to load tasks — ' + (e instanceof Error ? e.message : String(e))
      set({ loadError: message, pollError: message })
    } finally {
      set({ loading: false })
    }
  },
  ```
- [x] 4.3 Run `npm run typecheck` — must pass with zero errors.
- [x] 4.4 Run `npm test` — existing `loadData` tests must continue to pass.

## 5. T-56 — Confirm currentTaskMap is built only when merge is needed (post T-55)

- [x] 5.1 After completing T-55, verify in `src/renderer/src/stores/sprintTasks.ts` that `new Map(state.tasks.map(...))` appears only inside `mergeTasksWithPendingState` and nowhere else in the file.
- [x] 5.2 Verify that `loadData` only calls `mergeTasksWithPendingState` on the non-early-return path (i.e., when fingerprints differ or there are pending ops). The current structure of T-55's `loadData` already guarantees this — confirm by reading the control flow.
- [x] 5.3 Add a brief comment above the `currentTaskMap` construction inside `mergeTasksWithPendingState`:
  ```ts
  // Constructed here — not at poll entry — so it is only built when a merge is actually needed.
  const currentTaskMap = new Map(state.tasks.map((task) => [task.id, task]))
  ```
- [x] 5.4 Run `npm run typecheck` — must pass.
- [x] 5.5 Run `npm test` — must pass.

## 6. T-57 — Remove redundant .every() reference-equality scan (post T-56)

- [x] 6.1 In `src/renderer/src/stores/sprintTasks.ts`, inside `mergeTasksWithPendingState`, remove the `unchanged` variable and the conditional:
  ```ts
  // Remove this block entirely:
  const unchanged =
    nextTasksArr.length === state.tasks.length &&
    nextTasksArr.every((t, i) => t === state.tasks[i])
  return {
    tasks: unchanged ? state.tasks : nextTasksArr,
    pendingUpdates: nextPending
  }
  ```
- [x] 6.2 Replace with a direct return:
  ```ts
  return {
    tasks: Array.from(mergedById.values()),
    pendingUpdates: nextPending
  }
  ```
  (The `nextTasksArr` intermediate variable from T-55 can also be inlined here.)
- [x] 6.3 Run `npm run typecheck` — must pass.
- [x] 6.4 Run `npm test` — must pass. Confirm that any existing tests asserting reference stability of unchanged tasks still pass (they rely on `stableTaskRef`, not the `.every()` scan).

## 7. T-52 — Memoize visibleTasks slice in PipelineStage

- [x] 7.1 In `src/renderer/src/components/sprint/PipelineStage.tsx`, add `useMemo` to the React import:
  ```ts
  import React, { useRef, useState, useMemo } from 'react'
  ```
- [x] 7.2 Replace line 37:
  ```ts
  // Before
  const visibleTasks = expanded ? tasks : tasks.slice(0, STAGE_VISIBLE_LIMIT)
  // After
  const visibleTasks = useMemo(
    () => (expanded ? tasks : tasks.slice(0, STAGE_VISIBLE_LIMIT)),
    [tasks, expanded]
  )
  ```
- [x] 7.3 Run `npm run typecheck` — must pass.
- [x] 7.4 Run `npm test` — must pass.

## 8. T-58 — Inline single-use preserveField generic in sprintTasks

- [x] 8.1 In `src/renderer/src/stores/sprintTasks.ts`, locate the `preserveField<K extends SprintTaskField>` function (around line 69) and delete it.
- [x] 8.2 In `mergeSseUpdate` (the single call site), replace the loop body:
  ```ts
  // Before
  for (const field of pending.fields) {
    preserveField(merged, t, field)
  }
  // After
  for (const field of pending.fields) {
    ;(merged as Record<string, unknown>)[field] = (t as Record<string, unknown>)[field]
  }
  ```
- [x] 8.3 Run `npm run typecheck` — must pass with zero errors. If the cast causes a lint error, use the alternative: `merged[field] = t[field] as SprintTask[typeof field]` and verify it type-checks cleanly.
- [x] 8.4 Run `npm test` — must pass.

## 9. T-59 — Replace Object.fromEntries filter with destructuring spread in deleteTask

- [x] 9.1 In `src/renderer/src/stores/sprintTasks.ts`, in the `deleteTask` action (around line 285), replace:
  ```ts
  pendingUpdates: Object.fromEntries(
    Object.entries(state.pendingUpdates).filter(([id]) => id !== taskId)
  ),
  ```
  with:
  ```ts
  pendingUpdates: (() => {
    const { [taskId]: _, ...rest } = state.pendingUpdates
    return rest
  })(),
  ```
  (Note: this is the same IIFE pattern already established by T-54's `withoutPendingUpdate`. Alternatively, reuse `withoutPendingUpdate(state.pendingUpdates, taskId, true)` directly if T-54 has been applied — that is the preferred form.)
- [x] 9.2 Leave the `batchDeleteTasks` path unchanged — it filters by a Set across multiple IDs and the `Object.fromEntries` form is appropriate there.
- [x] 9.3 Run `npm run typecheck` — must pass.
- [x] 9.4 Run `npm test` — must pass.

---

## Final Verification

- [x] F.1 Run `npm run typecheck` — zero errors across the full project.
- [x] F.2 Run `npm test` — all tests pass including the three new `agentEvents.test.ts` cases.
- [x] F.3 Run `npm run lint` — zero errors (warnings acceptable).
- [x] F.4 Update `docs/modules/stores/index.md` to note the changes to `agentEvents.ts` and `sprintTasks.ts`.
- [x] F.5 Update `docs/modules/components/index.md` to note the changes to `PipelineHeader.tsx` and `PipelineStage.tsx`.
- [x] F.6 Update `docs/modules/hooks/index.md` if any new usage of `useBackoffInterval` is worth noting (the hook itself is unchanged).
