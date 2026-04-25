## 1. Constructor Injection for Mutations + Review Services

- [ ] 1.1 Read `src/main/services/sprint-mutations.ts` — find the Proxy / module-level singleton capture
- [ ] 1.2 Replace with `export function createSprintMutations(deps: { repo: ISprintTaskRepository }): SprintMutations`
- [ ] 1.3 Read `review-orchestration-service.ts` and `review-ship-batch.ts` — add `repo` to their `create*` factory params
- [ ] 1.4 Update `src/main/index.ts` composition root to pass repo instances to all three
- [ ] 1.5 All existing tests pass

## 2. ReviewGitOp Discriminated Union

- [ ] 2.1 Find where review git-op plans are built (likely in `review-orchestration-service.ts`)
- [ ] 2.2 Define `ReviewGitOp = { type: 'mergeLocally' } | { type: 'createPr'; ... } | { type: 'requestRevision'; ... } | { type: 'discard' }` in `src/shared/types/` or near the review services
- [ ] 2.3 Refactor `buildReviewGitOpPlan` to return `ReviewGitOp`
- [ ] 2.4 Refactor `executeReviewGitOp` to use an exhaustive switch
- [ ] 2.5 Unit test: passing an unknown `type` string produces a TypeScript error (compile-time check via `expectTypeOf` or `as never`)

## 3. sprint-service.ts Split

- [ ] 3.1 Create `src/main/services/sprint-use-cases.ts` — move `createTaskWithValidation`, `updateTaskFromUi` and any other orchestration functions there
- [ ] 3.2 `sprint-service.ts` becomes a barrel re-export only — add a file header comment noting this
- [ ] 3.3 Update any direct callers that should prefer the focused module

## 4. dependency-service.ts Split

- [ ] 4.1 Extract graph operations (cycle detection, reverse-index build) into a `DependencyGraph` class
- [ ] 4.2 Keep `shouldBlockTask` and blocking-policy logic in `dependency-service.ts` using `DependencyGraph`

## 5. Verification

- [ ] 5.1 `npm run typecheck` zero errors
- [ ] 5.2 `npx vitest run --config src/main/vitest.main.config.ts` all pass
- [ ] 5.3 `npm test` all pass
- [ ] 5.4 `npm run lint` zero errors
- [ ] 5.5 Update `docs/modules/services/index.md` for all changed files
