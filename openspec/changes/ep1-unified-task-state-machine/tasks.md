## 1. TaskStateService Foundation

- [ ] 1.1 Create `src/main/services/task-state-service.ts` with `TaskStateService` class, `TerminalDispatcher` interface, and `InvalidTransitionError`
- [ ] 1.2 Move `isValidTransition` policy call into `TaskStateService.transition()` — data layer keeps a secondary assertion only
- [ ] 1.3 Wire `TaskStateService` into the composition root (`src/main/index.ts`) with both `TerminalDispatcher` strategies (agent-manager + poller)
- [ ] 1.4 Add unit tests for `TaskStateService`: valid transition, invalid transition throws, terminal status calls dispatcher exactly once, non-terminal skips dispatcher

## 2. Wrap Existing Terminal Implementations

- [ ] 2.1 Implement `TerminalDispatcher` on `terminal-handler.ts` (agent-manager path) — expose a `dispatch(taskId, status)` method that wraps the existing `handleTaskTerminal` logic
- [ ] 2.2 Implement `TerminalDispatcher` on `task-terminal-service.ts` (PR-poller / manual path) — expose `dispatch(taskId, status)` wrapping `onStatusTerminal`
- [ ] 2.3 Update composition root to pass the correct dispatcher to `TaskStateService` for each context

## 3. Migrate Call Sites (T-26)

- [ ] 3.1 Audit all `updateTask({ status })` and direct `SET status=` calls — grep `updateTask.*status` and `status:.*TaskStatus` across `src/main/`
- [ ] 3.2 Migrate `sprint-local.ts` IPC handler status writes to `TaskStateService.transition()`
- [ ] 3.3 Migrate `sprint-mutations.ts` status writes to `TaskStateService.transition()`
- [ ] 3.4 Migrate `run-agent.ts` / `agent-manager` status writes (non-terminal paths) to `TaskStateService.transition()`
- [ ] 3.5 Migrate `already-done-check.ts` auto-complete write to `TaskStateService.transition()`
- [ ] 3.6 Migrate any remaining direct status writes in handlers, services, or migrations

## 4. Data Layer Cleanup (T-125)

- [ ] 4.1 Remove `isValidTransition` as the primary policy gate in `sprint-task-crud.ts` — demote to a DB-layer assertion (throw with a clear bypass-warning message)
- [ ] 4.2 Verify `updateTask` signature and doc comment clarifies it is no longer responsible for transition policy

## 5. Verification

- [ ] 5.1 Grep confirms zero `updateTask.*status` calls outside `TaskStateService` and `sprint-task-crud.ts` assertion
- [ ] 5.2 All existing tests pass (`npm test` + `npx vitest run --config src/main/vitest.main.config.ts`)
- [ ] 5.3 Update `docs/modules/services/index.md` with `task-state-service.ts` row
