# Security Audit & Hardening — BDE Professional Readiness

**Date:** 2026-04-03
**Approach:** Surgical hardening (C) — Queue API removal + critical bug fix + dependency scan
**Threat model:** Prevent data leakage over network; accept local file access risk with human-in-the-loop review

---

## Context

BDE is transitioning from personal development tool to professional use. The primary security concern is ensuring no data about work-in-progress leaks to the network or to other processes. Agent behavior risk is accepted — all agent output goes through Code Review Station before merge.

The codebase already follows strong security patterns: parameterized SQL, argument-array exec calls, Electron contextIsolation, DOMPurify + iframe sandbox, timing-safe auth. This audit focuses on the real gaps, not re-validating what already works.

---

## Work Item 1: Queue API Removal

### Rationale

The Queue API (`src/main/queue-api/`) runs an HTTP server on port 18790. Even bound to localhost, any local process can query it and discover task titles, specs, prompts, and status — revealing what the user is working on. The auto-generated API key bootstrapping also means the server may accept unauthenticated requests before first access.

External consumers (Life OS, claude-chat-service, claude-task-runner) are no longer needed for professional use. All task management happens through BDE's UI.

### Deletion Scope

**Delete entirely:**

- `src/main/queue-api/` (9 production files + 3 test files)
  - `index.ts`, `server.ts`, `router.ts`, `helpers.ts`
  - `task-handlers.ts`, `agent-handlers.ts`, `event-handlers.ts`
  - `sse-broadcaster.ts`, `field-mapper.ts`
  - `__tests__/queue-api.test.ts`, `__tests__/sse-broadcaster.test.ts`, `__tests__/field-mapper.test.ts`
- `src/shared/queue-api-contract.ts` (212 lines — types and constants only used by Queue API)
- `src/main/__tests__/integration/queue-api-integration.test.ts`
- `src/main/__tests__/integration/queue-api-sse.test.ts`
- `src/main/__tests__/integration/queue-api-auth.test.ts`

### Modifications

**`src/main/index.ts`** — Remove:

- Import: `import { startQueueApi, stopQueueApi } from './queue-api'`
- Import: `import { setQueueApiOnStatusTerminal } from './queue-api/task-handlers'`
- Line: `setQueueApiOnStatusTerminal(terminalService.onStatusTerminal)`
- Line: `startQueueApi({ port: 18790 })`
- Line: `app.on('will-quit', () => stopQueueApi())`

**`src/main/handlers/sprint-listeners.ts`** — Remove:

- Import of `sseBroadcaster` from `../queue-api/router`
- All `sseBroadcaster.broadcast(...)` calls (lines ~38, ~40)
- The listener functions can stay — they still push IPC events to the renderer. Just remove the SSE broadcast side-effect.

**`src/shared/ipc-channels.ts`** — Remove:

- Import: `import type { BatchOperation, BatchResult } from './queue-api-contract'`
- Move `BatchOperation` and `BatchResult` types inline if `sprint:batchUpdate` IPC channel still needs them, OR delete the channel if it was Queue-API-only.

**`src/main/handlers/sprint-local.ts`** — Remove:

- Dynamic import of `GENERAL_PATCH_FIELDS` from queue-api-contract (~line 382). If sprint-local uses this for its own field validation, move the allowlist constant inline.

**`src/renderer/src/stores/sprintEvents.ts`** — Remove:

- Import of `TaskOutputEvent` from `queue-api-contract`. Move the type definition to `src/shared/types.ts` if the renderer still uses it, or inline it.

**`src/renderer/src/stores/__tests__/sprintEvents.test.ts`** — Update import path to match.

**`src/renderer/src/lib/constants.ts`** — Verify:

- `WIP_LIMIT_IN_PROGRESS = 5` — if this is only used by renderer UI (e.g., pipeline display), keep it as a standalone constant. It no longer needs to "sync with MAX_ACTIVE_TASKS."

**Settings UI** — Remove:

- Any API key display/copy UI in Settings (likely in a "Connections" or "Agent" tab). The `taskRunner.apiKey` setting is no longer needed.

**`src/main/services/task-terminal-service.ts`** — Verify:

- Remove Queue API status patch as a terminal trigger path if it's explicitly wired. The remaining paths (agent manager, `sprint:update` IPC, PR poller) are sufficient.

**`src/main/agent-system/skills/task-orchestration.ts`** — Remove:

- Hardcoded `http://localhost:18790/queue/tasks` URLs and curl examples (~lines 47-62)
- `queue-api-call` from the skill's capabilities array

**`src/main/agent-system/skills/debugging.ts`** — Remove:

- Hardcoded `curl -X PATCH "http://localhost:18790/queue/tasks/<id>/status"` (~line 26)
- `queue-api-call` from the skill's capabilities array

**`src/main/agent-system/skills/__tests__/skills.test.ts`** — Remove:

- Assertions on `queue-api-call` capability (~lines 46, 63)

**Test mocks referencing `queue-api/router`** — Remove mock declarations from:

- `src/main/handlers/__tests__/sprint-local.test.ts` (~line 91): `vi.mock('../../queue-api/router', ...)`
- `src/main/handlers/__tests__/sprint-listeners.test.ts` (~line 5): same mock
- `src/main/services/__tests__/sprint-service.test.ts` (~lines 32-33): same mock

These mocks will cause import resolution errors once `queue-api/router.ts` is deleted.

### Post-Removal Verification

- `npm run typecheck` — zero errors
- `npm test` — all remaining tests pass
- `npm run test:main` — integration tests pass (Queue API tests deleted)
- `npm run lint` — clean
- Manual: confirm no HTTP server starts (no port 18790 listener)

---

## Work Item 2: Playground Path Traversal Fix

### Vulnerability

**File:** `src/main/handlers/playground-handlers.ts` (lines 14-47)

The `playground:show` IPC handler accepts an arbitrary `filePath`, checks only for `.html` extension, then reads the file with `readFile()`. No path boundary validation. Any renderer code (or compromised renderer) could read arbitrary `.html` files from the system, or — since the extension check is the only guard — any file renamed to `.html`.

### Existing Secure Patterns

Two correct implementations already exist in the codebase:

1. **`run-agent.ts` (line ~95-141):** Validates `resolvedPath.startsWith(resolvedWorktree)` before reading. Used for auto-detected playground files during agent execution.

2. **`ide-fs-handlers.ts` (line ~53-94):** `validateIdePath()` — production-grade validation with symlink resolution via `fs.realpathSync()`, parent fallback for new files, and boundary check.

### Fix

Apply the `validateIdePath` pattern to `playground-handlers.ts`:

1. The handler must require a `rootPath` parameter (the repo or worktree root the file belongs to)
2. Before reading, call `validateIdePath(filePath, rootPath)` to resolve symlinks and enforce boundary
3. If validation fails, throw and log — do not read the file

If `playground:show` is only ever called from the agent console (where the agent's worktree path is known), consider removing the handler entirely and relying solely on the secure auto-detection in `run-agent.ts`. This is the safest option if no manual playground invocation is needed.

### Call Site Impact

The `playground:show` IPC channel is invoked from renderer components (likely `PlaygroundCard` or agent console). Changes required:

- Update IPC channel signature in `src/shared/ipc-channels.ts` to include `rootPath` parameter
- Update `src/preload/index.d.ts` type declaration to match
- Update renderer call site(s) to pass the agent's repo path or worktree path as `rootPath`

### Test Coverage

Add a test case to `src/main/handlers/__tests__/playground-handlers.test.ts` (or integration tests) that verifies:

- Path traversal with `../../etc/passwd` is blocked
- Symlink escape is blocked
- Valid path within root succeeds

---

## Work Item 3: Dependency Vulnerability Remediation

### npm audit Results (2026-04-03)

8 vulnerabilities found (4 moderate, 4 high):

| Package                | Severity | Issue                                                                | Fix                                                |
| ---------------------- | -------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| `@xmldom/xmldom`       | High     | XML injection via CDATA serialization                                | `npm audit fix`                                    |
| `flatted`              | High     | Prototype pollution via `parse()`                                    | `npm audit fix`                                    |
| `lodash`               | High     | Code injection via `_.template` + prototype pollution                | `npm audit fix`                                    |
| `picomatch`            | High     | ReDoS + method injection in POSIX classes                            | `npm audit fix`                                    |
| `brace-expansion`      | Moderate | Zero-step sequence causes hang                                       | `npm audit fix`                                    |
| `electron`             | Moderate | 3 issues (nodeIntegration scoping, header injection, use-after-free) | `npm audit fix`                                    |
| `dompurify` (Monaco's) | Moderate | 4 mutation-XSS variants                                              | Breaking change — requires `npm audit fix --force` |

### Remediation Strategy

**Phase 1 — Safe fixes:** Run `npm audit fix` (no breaking changes). This resolves xmldom, flatted, lodash, picomatch, brace-expansion, and electron.

**Phase 2 — DOMPurify assessment:** Monaco bundles its own DOMPurify (<=3.3.1) with known mutation-XSS issues. However:

- BDE uses its own DOMPurify (`dompurify@^3.3.3`) for playground sanitization — verify this is patched (>=3.3.2)
- Monaco's bundled copy is used internally for its own rendering, not for user content
- The `--force` fix downgrades Monaco to 0.53.0 (breaking) — assess whether this is worth the trade-off
- **Recommendation:** If BDE's own DOMPurify is current, accept Monaco's internal copy as low risk. Monaco renders trusted editor content, not user-supplied HTML.

**Phase 3 — Verify after fix:**

- `npm run typecheck` — zero errors
- `npm test` — all tests pass
- `npm run dev` — app launches and renders correctly

---

## Work Item 4: Documentation Cleanup

### CLAUDE.md Updates

Remove all Queue API references from `CLAUDE.md`:

- Architecture notes: Queue API section, port 18790, SSE broadcaster
- Gotchas: auth bootstrapping, endpoints, `depends_on` format, `GENERAL_PATCH_FIELDS`, bulk task creation, PR fields not API-patchable
- Cross-repo contracts: "Two writers to sprint_tasks" → now just one (SQLite directly via IPC)
- Key file locations: queue-api references
- Integration tests: queue-api test file references
- Key conventions: WIP limit enforcement note

### BDE_FEATURES.md Updates

- Remove Queue API feature section (lines 52-66)
- Update task lifecycle flow (step 2) — tasks enter pipeline via UI, not external API
- Remove Queue API from "Related" links throughout
- Remove WIP limit Queue API enforcement note from Agent Manager section

### Global CLAUDE.md (~/)

- Update BDE project description: remove "Serves Queue API on port 18790"
- Update cross-repo contracts: remove "Two writers to sprint_tasks" — now just BDE main process via SQLite
- Note that Life OS, claude-chat-service, claude-task-runner no longer have a BDE integration point

### docs/architecture.md

- Remove Queue API section (port 18790, `queue-api/` module, SSE server references)
- Remove `TaskQueueAPI` from architecture diagrams
- Update data flow descriptions to reflect IPC-only task management

### docs/agent-system-guide.md

- Remove `queue-api-call` from skill capability table (~line 116)
- Update any references to Queue API as an agent interaction method

---

## Out of Scope (Accepted Risks)

These were evaluated and explicitly accepted:

- **OAuth token as plaintext file** (`~/.bde/oauth-token`) — local-only, file permissions enforced at 0o600
- **SQLite unencrypted at rest** — local-only, standard for dev tools
- **Agent prompt injection** — mitigated by human review in Code Review Station
- **Unsigned Electron build** — acceptable for personal distribution; signing can be added later
- **`sandbox: false` in webPreferences** — required for preload script file I/O; mitigated by contextIsolation
- **Dev-mode CSP permissiveness** — only applies in development, not production builds
- **`src/main/runner-client.ts`** — outbound HTTP client to claude-task-runner (port 18799). This is a separate service not running in professional use; calls fail gracefully and return empty arrays. Can be removed in a follow-up if desired.

---

## Verification Checklist

After all work items complete:

- [ ] No HTTP server starts on any port (verify with `lsof -i -P | grep node`)
- [ ] `npm audit` shows 0 high vulnerabilities (moderate DOMPurify in Monaco accepted)
- [ ] `playground:show` rejects paths outside allowed root
- [ ] `npm run typecheck` — zero errors
- [ ] `npm test` — all tests pass
- [ ] `npm run test:main` — integration tests pass
- [ ] `npm run lint` — clean
- [ ] `npm run build` — production build succeeds
- [ ] CLAUDE.md has no Queue API references
- [ ] BDE_FEATURES.md has no Queue API references
