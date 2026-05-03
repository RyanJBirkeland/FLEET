# Per-Repo Environment Variable Injection

**Issue:** #704 — Pipeline agent can't authenticate to private npm registry  
**Date:** 2026-05-02

## Problem

`buildAgentEnv()` produces a generic allowlisted environment for every agent spawn.
Repos that require credentials not in the allowlist — private npm registries
(`NODE_AUTH_TOKEN`), DB connection strings for integration tests, etc. — silently
fail at verification time after burning agent budget on doomed retries.

The fix is not to keep appending specific tokens to the global allowlist (that couples
the allowlist to every downstream auth convention). The correct abstraction is: each
repo declares its own required environment variables, and the spawn path merges them in.

---

## Data Model

`RepoConfig` in `src/main/paths.ts` gains one optional field:

```ts
envVars?: Record<string, string>
```

Values are plaintext strings. They are stored as part of the `repos` JSON blob in the
`settings` SQLite table — no migration required since the field is optional inside
existing JSON. The `isRepoConfig` validator is updated to accept (not require) `envVars`.

**Security note:** these values are stored in plaintext in `~/.fleet/fleet.db`. The
Settings UI displays a visible warning. Users are expected to store non-secret values
(registry URLs, scope config) or accept the plaintext risk for tokens — the same
tradeoff as storing tokens in `.npmrc`.

---

## New Helper: `getRepoEnvVars`

Added to `src/main/paths.ts` alongside the existing `getRepoConfig` family:

```ts
export function getRepoEnvVars(repoSlug: string | null | undefined): Record<string, string> {
  if (!repoSlug) return {}
  return getRepoConfig(repoSlug)?.envVars ?? {}
}
```

This is the only place that reads `envVars` from storage — callers never reach into
`RepoConfig` directly.

---

## Injection Point

### Why not `buildAgentEnv()`

`buildAgentEnv()` is cached after first call and knows nothing about which repo is being
targeted. Injecting per-repo vars there would require cache invalidation per task, which
breaks the function's contract.

### The right location

The repo slug is known in `run-agent.ts` at the point it calls `spawnAndWireAgent`.
Per-repo vars are computed there and threaded through the call chain as `extraEnv`:

```
run-agent.ts         getRepoEnvVars(task.repo) → extraEnv
  ↓
spawn-and-wire.ts    spawnAndWireAgent(..., extraEnv)
  ↓
sdk-adapter.ts       spawnWithTimeout(..., extraEnv)
  ↓
sdk-adapter.ts       spawnClaudeAgent({ ..., extraEnv })
  ↓
sdk-adapter.ts       const env = { ...buildAgentEnv(), ...extraEnv }
```

The merge is `{ ...base, ...extraEnv }` — repo vars win over base vars. This is
intentional: if a user sets `PATH` in their repo env vars, they deserve the result.

### `spawnWithTimeout` signature

`spawnWithTimeout` already has ten positional parameters — a pre-existing smell this
change does not worsen by adding an eleventh. The parameter is appended last and
optional, so all existing callers require no change.

### Adhoc agents

Adhoc and assistant agents (`adhoc-agent.ts`) are not tied to a specific sprint task
and therefore have no `task.repo` at spawn time. They receive no per-repo injection
in this change. If adhoc agents need repo-specific vars in the future, the env var
editor in Settings provides a path.

---

## Settings UI

**Location:** `src/renderer/src/components/settings/RepositoriesSection.tsx`

Each repo row gets an expandable **Environment Variables** section beneath its existing
fields (name, path, GitHub owner/repo, color, prompt profile). The section shows a
key-value list editor:

- Each row: `[key input] [value input] [remove button]`
- Footer: `[+ Add variable]` button
- Plaintext warning banner: *"Values are stored unencrypted in the app database. Do not
  store secrets you would not write to .npmrc or a .env file."*

The local `RepoConfig` interface in `RepositoriesSection.tsx` gains `envVars?:
Record<string, string>`. Saving a repo writes the full config including `envVars` via
the existing `window.api.settings.setJson('repos', updated)` path.

---

## Files to Change

| File | Change |
|---|---|
| `src/main/paths.ts` | Add `envVars?` to `RepoConfig`; add `getRepoEnvVars()`; update `isRepoConfig` validator |
| `src/main/agent-manager/sdk-adapter.ts` | Add `extraEnv?` to `spawnClaudeAgent` opts and `spawnWithTimeout`; merge in env build |
| `src/main/agent-manager/spawn-and-wire.ts` | Thread `extraEnv?` through `spawnAndWireAgent` |
| `src/main/agent-manager/run-agent.ts` | Call `getRepoEnvVars(task.repo)` and pass to `spawnAndWireAgent` |
| `src/renderer/src/components/settings/RepositoriesSection.tsx` | Add `envVars` to local type + key-value editor UI |
| `src/renderer/src/components/settings/RepositoriesSection.css` | Styles for env var editor rows |
| `docs/modules/lib/main/index.md` | Update `paths.ts` row — add `getRepoEnvVars` to public API list |

---

## Testing

### Unit tests

**`src/main/__tests__/env-utils.test.ts`** (or `paths.test.ts`):
- `getRepoEnvVars` returns empty object for null/undefined/unconfigured repo
- `getRepoEnvVars` returns the configured vars for a known repo slug (case-insensitive,
  matching `getRepoConfig` semantics)
- `getRepoEnvVars` returns empty object when `envVars` is absent from the config

**`src/main/agent-manager/__tests__/spawn-sdk-contract.test.ts`** (or adjacent):
- When `extraEnv` is provided, the spawned env contains those keys
- When `extraEnv` is absent, spawn proceeds identically to current behavior
- Repo vars do not override `ANTHROPIC_API_KEY` set by the auth layer *unless* the
  user explicitly puts `ANTHROPIC_API_KEY` in `envVars` (document, not prevent)

### Settings UI tests

- Renders existing repos with no `envVars` without crashing
- Adding a key-value pair updates local state
- Saving persists `envVars` as part of the repo config JSON

---

## What This Does Not Do

- Does not encrypt values at rest (deferred; noted as future work in UI)
- Does not inject per-repo vars into adhoc/assistant/reviewer agents
- Does not auto-detect `.npmrc` or `.env` files in the repo and pull vars from them
- Does not add `NODE_AUTH_TOKEN` to the global allowlist (that approach is retired
  in favour of this one)
