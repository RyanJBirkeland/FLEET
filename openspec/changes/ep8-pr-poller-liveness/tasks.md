## 1. Timeout + Single-Flight

- [ ] 1.1 Read `src/main/sprint-pr-poller.ts` fully
- [ ] 1.2 Add `POLL_TIMEOUT_MS = 30_000` and wrap `poll()` call with `Promise.race([poll(), sleep(POLL_TIMEOUT_MS).then(() => { throw new PollTimeoutError() })])`
- [ ] 1.3 Add instance-scoped `_pollInProgress` flag in `createSprintPrPoller` closure; skip tick if set
- [ ] 1.4 Unit tests: timeout fires → WARN logged; concurrent poll → second tick skipped

## 2. Terminal Notify Retry Queue

- [ ] 2.1 Add `pendingTerminalRetries: Map<string, { status, attempts }>` in the poller closure
- [ ] 2.2 In `notifyTaskTerminalBatch`: on failure, add to retry map; on success, remove from map
- [ ] 2.3 At start of each poll cycle: flush retry queue (attempt each pending retry)
- [ ] 2.4 Cap retries at 5; after cap, log ERROR and remove
- [ ] 2.5 Unit test: terminal notify fails → queued; succeeds on retry → removed

## 3. Auth/Rate-Limit Warning Toast

- [ ] 3.1 In `safePoll` catch: detect auth (401/403) and rate-limit errors by message/status code
- [ ] 3.2 On detection: `broadcast('manager:warning', { message: 'GitHub PR poll failed: ...' })`
- [ ] 3.3 Unit test: 401 error → broadcast called with warning message

## 4. Legacy Singleton Removal + Heartbeat

- [ ] 4.1 Grep callers of `startSprintPrPoller` / `stopSprintPrPoller` — confirm only `index.ts`
- [ ] 4.2 Update `index.ts` to use `createSprintPrPoller(deps).start()` directly
- [ ] 4.3 Remove `startSprintPrPoller`, `stopSprintPrPoller`, `_instance` from `sprint-pr-poller.ts`
- [ ] 4.4 Add DEBUG-only heartbeat when no tasks have open PRs: `logger.event('pr-poller.tick.idle', { taskCount: 0 })`

## 5. Verification

- [ ] 5.1 `npm run typecheck` zero errors
- [ ] 5.2 `npx vitest run --config src/main/vitest.main.config.ts` all pass
- [ ] 5.3 `npm run lint` zero errors
- [ ] 5.4 Update `docs/modules/` for `sprint-pr-poller.ts`

> Phase A invariant: this change satisfies the **bounded retry queues with structured exhaustion events** invariant in `pipeline-stop-the-bleeding/specs/pipeline-correctness-baseline/spec.md`.
