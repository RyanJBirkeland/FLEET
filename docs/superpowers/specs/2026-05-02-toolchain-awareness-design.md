# Per-Repo Toolchain Awareness — Design

**Date:** 2026-05-02
**Context:** Issue #702 — two related failures surfaced during dogfooding against non-FLEET repos (specifically `openapi-frontends`, a turborepo monorepo): (1) `node_modules/.bin` is not on PATH when the verification gate runs `npm run typecheck`, causing `turbo: command not found`; (2) there is no pre-flight check before spawning an agent into a repo whose required toolchain binaries are missing, so the agent retries N times at ~$1.50/cycle before a human notices the environment is broken.

This document covers the two highest-ROI fixes. The follow-up epic (per-repo toolchain manifest in Settings + credentials audit panel) is out of scope here.

---

## Problem

### PATH gap in verification gate and agent spawn

`buildAgentEnv()` builds a global cached env snapshot at startup. It prepends the resolved `node` and `git` directories plus a set of well-known tool paths, but it has no knowledge of any specific worktree. When `npm run typecheck` is invoked inside a worktree, `npm` normally augments `PATH` with the project's `node_modules/.bin` before executing the script. This augmentation does not happen reliably when `node_modules` is a symlink (as FLEET creates it) — npm's workspace-root detection can resolve to the main checkout rather than the worktree, and the `sh -c` that runs `turbo run typecheck` never gets `node_modules/.bin` in its `PATH`.

Result: every turborepo verification run fails with `sh: turbo: command not found`, the task retries up to three times, and the failure reason points at a toolchain gap rather than a code problem.

The same gap affects pipeline agents themselves: if an agent tries to run `turbo`, `pnpm`, or any other locally-installed binary directly in a shell command, it hits the same missing-PATH failure.

### No pre-flight binary check

The drain loop claims a queued task and immediately spawns an agent with no prior check that the repo's required toolchain is available. For a Gradle repo with no `java` on PATH, or a turborepo with no `turbo` installed, the agent will fail at its first shell command, retry, fail again, and exhaust retries — all for a purely environmental reason that a 10ms probe could have caught.

---

## Design

### Piece 1 — `buildWorktreeEnv(worktreePath)`

Add a new function to `src/main/env-utils.ts`:

```typescript
export function buildWorktreeEnv(worktreePath: string): Record<string, string | undefined> {
  const base = buildAgentEnv()
  const binDir = join(worktreePath, 'node_modules', '.bin')
  if (!existsSync(binDir)) return base
  const current = base.PATH ?? ''
  return { ...base, PATH: [binDir, ...current.split(':').filter(Boolean)].join(':') }
}
```

Uses the existing named `join` import from `node:path` (already in scope in `env-utils.ts`). Pure, not cached — each call site supplies its own `worktreePath`. Falls back to `buildAgentEnv()` unchanged when `node_modules/.bin` does not exist (non-Node repos). No mutation of the global `_cachedEnv`.

**Call sites:**

| File | Change |
|---|---|
| `src/main/agent-manager/verify-worktree.ts` | `execFileRunCommand` calls `buildWorktreeEnv(cwd)` instead of `buildAgentEnv()` — no signature change, `cwd` is already a parameter |
| `src/main/agent-manager/sdk-adapter.ts` | `spawnClaudeAgent` accepts a new optional `worktreePath?: string` parameter; when present, calls `buildWorktreeEnv(worktreePath)` instead of `{ ...buildAgentEnv() }` for the spawn env. Thread `worktreePath` through `spawnAgent` → `spawnWithTimeout` → `spawnClaudeAgent`. |

**Why `sdk-adapter.ts` and not `run-agent.ts`:** env is currently constructed inside `spawnClaudeAgent` in `sdk-adapter.ts`, not passed in from callers. The worktree path must travel through `spawnWithTimeout` and `spawnAgent` (both get a new optional `worktreePath?: string` parameter) to reach `spawnClaudeAgent` where the env is built. `run-agent.ts`'s `runSpawnPhase` already has `worktree.path` from `SetupWorktreeResult` — it passes it to `spawnWithTimeout` as the new optional parameter.

---

### Piece 2 — Pre-flight toolchain check

#### Detection (`src/main/agent-manager/preflight-check.ts`)

`detectToolchain(repoPath)` reads the repo root synchronously and returns a list of `ToolchainSignal` entries, each pairing a detection condition with a binary to probe:

| Signal | Binary |
|---|---|
| `turbo.json` exists OR `package.json` scripts includes `"turbo"` | `turbo` (check `<repoPath>/node_modules/.bin/turbo` first via `existsSync`, then PATH) |
| `pnpm-workspace.yaml` OR `pnpm-lock.yaml` | `pnpm` |
| `.yarnrc.yml` | `yarn` |
| `gradlew` | `java` (PATH) + `./gradlew` (local `existsSync`) |
| `pom.xml` (no `gradlew`) | `mvn` |
| `pyproject.toml` OR `poetry.lock` | `python`, `poetry` |
| `Cargo.toml` | `cargo` |

Plain npm projects (only `package.json`, none of the above signals) get no additional checks — `node` and `npm` are already on PATH via `buildAgentEnv`.

`runPreflightChecks(repoPath, env)` calls `detectToolchain`, then probes each binary:
- Repo-local binaries (e.g. `gradlew`, turbo in `node_modules/.bin`): `existsSync` — no subprocess needed.
- PATH binaries: `execFileAsync('which', [binary], { env, timeout: 5000 })` — never a shell string, always an argument array.

Returns:

```typescript
type PreflightResult =
  | { ok: true }
  | { ok: false; missing: string[] }
```

Detection errors (bad `package.json` JSON, `EACCES`, etc.) are caught and logged at `warn`; the function returns `{ ok: true }` on any detection failure — a broken detector must not block spawning.

#### Gate (`src/main/agent-manager/preflight-gate.ts`)

Owns the pending confirmation promises:

```typescript
interface PreflightGate {
  requestConfirmation(taskId: string, missing: string[], repoName: string, taskTitle: string): Promise<boolean>
  resolveConfirmation(taskId: string, proceed: boolean): void
}
```

`requestConfirmation` stores a `{ resolve }` in a `Map<taskId, ...>`, broadcasts `agent:preflightWarning { taskId, repoName, taskTitle, missing }` to the renderer, and returns the promise. The promise auto-resolves `false` after a 5-minute timeout (renderer not open, user ignores).

`resolveConfirmation` looks up the pending entry by `taskId` and calls `resolve(proceed)`.

#### Drain loop integration

Pre-flight runs **inside `processQueuedTask`**, after the existing `isProcessing(taskId)` guard (which prevents double-processing) and before `validateAndClaimTask`. This placement ensures the task is already marked processing before the modal broadcast fires, so subsequent drain ticks skip it while the user is deciding.

```
processQueuedTask(task):
  1. isProcessing(taskId) guard  ← existing, unchanged
  2. markProcessing(taskId)      ← existing, unchanged
  3. runPreflightChecks(repoPath, env)   ← NEW
     → { ok: true }:  proceed to validateAndClaimTask → spawn (existing flow)
     → { ok: false, missing }:
         unmarkProcessing(taskId)   ← release the guard so task stays visible
         proceed = await preflightGate.requestConfirmation(taskId, missing, repoName, task.title)
         proceed=true:
           re-markProcessing(taskId)
           validateAndClaimTask → spawn, with notes prepended:
             "⚠ Pre-flight warning: missing binaries [<list>]. Proceeding as requested."
         proceed=false:
           updateTask(id, { status: 'backlog',
             notes: 'Moved to backlog: pre-flight detected missing binaries: <list>.' })
```

`unmarkProcessing` / `re-markProcessing` around the `await` prevents the task from being stuck in the processing set for the 5-minute modal window while still being invisible to the drain loop during the await.

#### IPC channels

`agent:preflightWarning` is a **broadcast** (main→renderer push) — add it to `src/shared/ipc-channels/broadcast-channels.ts` under `BroadcastChannels`:

```typescript
'agent:preflightWarning': { taskId: string; repoName: string; taskTitle: string; missing: string[] }
```

`agent:preflightResponse` is a **renderer→main invoke** — add it to `src/shared/ipc-channels/agent-channels.ts`:

```typescript
'agent:preflightResponse': { taskId: string; proceed: boolean } → void
```

Use the `onBroadcast<T>(channel)` factory in `src/preload/index.ts` to wire up the broadcast subscription.

#### Handler (`src/main/handlers/agent-handlers.ts`)

New `safeHandle('agent:preflightResponse', ...)` entry that calls `preflightGate.resolveConfirmation(taskId, proceed)`.

#### Modal (`src/renderer/src/components/sprint/PreflightWarningModal.tsx`)

Mounted at app root alongside `TaskWorkbenchModal`. Subscribes to `agent:preflightWarning` broadcasts via the preload bridge — payloads are pushed into `preflightStore`'s queue. On receipt, opens a modal (using the shared `Modal` primitive) showing:

- Repo name and task title (from payload)
- List of missing binaries
- Warning that the agent will likely fail without them
- Two actions: **Proceed anyway** (yellow/warning tone) and **Move to backlog** (default/safe)

On either action, calls `ipc.invoke('agent:preflightResponse', { taskId, proceed })` and closes.

Only one warning modal is shown at a time — if a second `preflightWarning` arrives while one is open, it queues behind the first.

#### Store (`src/renderer/src/stores/preflightStore.ts`)

New dedicated store — do not add to `sprintUI.ts` (CLAUDE.md: "Don't add state to `sprintUI.ts`"):

```typescript
preflightQueue: Array<{ taskId: string; repoName: string; taskTitle: string; missing: string[] }>
// actions: enqueue(payload), dequeue() → shifts head off queue
```

---

## Error Handling Summary

| Scenario | Behaviour |
|---|---|
| Detection throws (bad JSON, EACCES) | Log warn, treat as `ok: true` — spawn proceeds |
| Binary probe hangs | 5s timeout per `execFileAsync('which', ...)` → treated as not-found |
| Modal timeout (5 min, no response) | Treat as cancel — task bumped to backlog, warn logged |
| Task claimed by another process after pre-flight unmarks processing | Existing `validateAndClaimTask` claim-conflict guard handles it |
| Renderer not open | Timeout fires after 5 min → backlog |
| Second pre-flight warning arrives while modal open | Queued in `preflightStore`, shown after current modal resolves |

---

## Testing

- `preflight-check.ts`: unit tests with mock `existsSync` and `execFileAsync` — each signal file triggers the correct binary list; repo-local binary found via `existsSync`; PATH binary probed via `execFileAsync('which', [binary])`; detection errors return `{ ok: true }`; binary probe timeout returns not-found.
- `preflight-gate.ts`: unit tests — `requestConfirmation` resolves to `true` when `resolveConfirmation(id, true)` called; auto-resolves `false` after timeout; second request queues behind first.
- `env-utils.ts`: unit test for `buildWorktreeEnv` — prepends `node_modules/.bin` when it exists; returns base env unchanged when it does not.
- `verify-worktree.ts`: mock `buildWorktreeEnv` at the module level (`vi.mock('../env-utils', ...)`) and assert the default `execFileRunCommand` calls it with the `cwd` argument.
- `sdk-adapter.ts`: assert that `spawnClaudeAgent` uses `buildWorktreeEnv(worktreePath)` when `worktreePath` is provided, and falls back to `buildAgentEnv()` when absent.
- Integration: drain loop tests mock `runPreflightChecks` to return `{ ok: false, missing: ['turbo'] }`, mock `preflightGate.requestConfirmation` to resolve `false`, and assert task transitions to `backlog`.

---

## Out of Scope (follow-up epic)

- Per-repo toolchain manifest in Settings (manual declaration of toolchain type, custom PATH entries, custom verify commands)
- Credentials/permissions audit panel (gh auth status, npm registry tokens, DB credentials)
