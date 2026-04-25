## 1. Git Timeouts

- [ ] 1.1 Add `GIT_EXEC_TIMEOUT_MS = 30_000` constant in `completion.ts` or a shared constants file
- [ ] 1.2 Grep `src/main/agent-manager/completion.ts`, `resolve-success-phases.ts`, `review-transition.ts` for `execFileAsync('git'` — wrap each with the timeout option
- [ ] 1.3 Add unit test: mock `execFileAsync` that resolves after timeout → completion path receives timeout error

## 2. SuccessPhase Refactor

- [ ] 2.1 Read `resolve-success-phases.ts` fully before editing
- [ ] 2.2 Define `SuccessPhase = { name: string; run(ctx: ResolveSuccessContext): Promise<void> }` interface
- [ ] 2.3 Extract each of the 9 steps into a named `SuccessPhase` object
- [ ] 2.4 `resolveSuccess` becomes: `for (const phase of phases) { await phase.run(ctx) }`
- [ ] 2.5 All existing completion tests still pass

## 3. No-Op Log + Decision Logs

- [ ] 3.1 When no-op guard fires, log `logger.event('completion.noop', { taskId, changedFiles: [] })`
- [ ] 3.2 Add log on requeue-vs-terminal decision: `logger.event('completion.decision', { taskId, decision, reason })`
- [ ] 3.3 Add log on commit count + rebase outcome during review transition

## 4. PreReviewAdvisor Chain

- [ ] 4.1 Define `PreReviewAdvisor = { name: string; advise(ctx): Promise<string | null> }` interface
- [ ] 4.2 Wrap existing untouched-tests and unverified-refs checks as `PreReviewAdvisor` implementations
- [ ] 4.3 Orchestrator iterates advisors, catches errors per-advisor, appends non-null warnings to `task.notes`

## 5. Verification

- [ ] 5.1 `npm run typecheck` zero errors
- [ ] 5.2 `npx vitest run --config src/main/vitest.main.config.ts` all pass
- [ ] 5.3 `npm run lint` zero errors
- [ ] 5.4 Update `docs/modules/agent-manager/index.md` for changed files
