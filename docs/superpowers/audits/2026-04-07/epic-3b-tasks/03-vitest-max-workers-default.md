# Cap VITEST_MAX_WORKERS for agent-spawned test runs

## Problem

During the Epic 1 + Epic 3 dogfood sessions, running 3-6 pipeline agents in parallel drove the machine to load average 100-141. Root cause: each agent runs its own `npm run test:coverage` which spawns vitest with default `workerThreads = CPU-count`. On a typical 8-core laptop, that's 3 agents × 8 workers = 24 test worker processes competing for CPU simultaneously, plus the agents themselves, plus the pre-push hook re-running the suite on each push.

The audit's SYNTHESIS.md appendix documents this as a new CRITICAL finding from the dogfood loop.

## Solution

Set `VITEST_MAX_WORKERS=2` as a default in `buildAgentEnv()` so every agent-spawned process (pipeline, adhoc, assistant, copilot, synthesizer) gets a safe cap on its test parallelism. Users can still override by setting their own value in `process.env.VITEST_MAX_WORKERS` before starting BDE — the existing value takes precedence.

The exact edit is in `src/main/env-utils.ts` in the `buildAgentEnv()` function (around lines 55-79). After the existing "prepend extra paths to PATH" block and BEFORE the `_cachedEnv = env` assignment, add:

```ts
// Cap vitest worker parallelism for agent-spawned test runs. Each agent runs
// its own test:coverage; at MAX_ACTIVE_TASKS > 1 the default (CPU-count) causes
// CPU oversubscription. Users can override by setting VITEST_MAX_WORKERS
// before launching BDE.
env.VITEST_MAX_WORKERS = env.VITEST_MAX_WORKERS ?? '2'
```

Note: this intentionally uses `env.VITEST_MAX_WORKERS` not `process.env.VITEST_MAX_WORKERS` because `env` already contains the user's value (if any) via the `npm_config_*` block above — actually wait, `VITEST_MAX_WORKERS` is NOT an `npm_config_*` var. Read the existing `ENV_ALLOWLIST` array at the top of the file and add `'VITEST_MAX_WORKERS'` to it if it's not present, so that a user-set value is picked up. Then the `??` fallback in the block above kicks in only when the user didn't set it.

Don't touch anything else. Don't change how `buildAgentEnv` is cached. Don't modify the pre-commit checks.

## Files to Change

- `src/main/env-utils.ts` — add `VITEST_MAX_WORKERS` to `ENV_ALLOWLIST` and default it to `'2'` in `buildAgentEnv()`

## How to Test

1. `npm run typecheck` — 0 errors
2. `npm run test:coverage` — all tests pass. If flakes appear, re-run specific files in isolation first before concluding anything about pre-existing failures.
3. `npm run test:main` — all tests pass. Add a regression test in `src/main/__tests__/env-utils.test.ts` (or wherever `buildAgentEnv` tests live — grep for `buildAgentEnv` in `src/main/__tests__/`): assert that `buildAgentEnv()` returns an `env` object with `VITEST_MAX_WORKERS === '2'` when no env var is set, and returns the user's value when one IS set. Use `vi.stubEnv` if the test file uses vitest's env stubbing, or mock `process.env` directly if that's the existing pattern.
4. `npm run lint` — 0 errors

## Out of Scope

- Changing other test parallelism settings (NODE_OPTIONS, etc.)
- Modifying vitest config itself
- Any agent-manager-level concurrency changes
- Documenting this in CLAUDE.md or BDE_FEATURES.md
- Tuning the cap per agent type
- Making it configurable via the Settings UI
