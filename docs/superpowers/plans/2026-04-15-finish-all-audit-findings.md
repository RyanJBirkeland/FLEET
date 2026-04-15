# Finish All Audit Findings — Consolidated Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every outstanding finding from the April 2026 audit cycle and complete the two remaining plan files (clean-code-orchestration, prompt-system-optimization).

**Architecture:** Ordered by priority — security/correctness first, then Tier 1 code quality, then agent-reliability improvements, then internal refactors. Each task is independently mergeable. All work in `~/worktrees/BDE/fix/audit-finish`.

**Tech Stack:** TypeScript, Electron, better-sqlite3, Vitest, Zustand, React

---

## Verified Complete (DO NOT RE-IMPLEMENT)

The following findings are confirmed done in main — skip them:
- SQLite indices on `started_at`/`completed_at` (v050-v052 migrations)
- DOMPurify ALLOWED_TAGS whitelist (`playground-sanitize.ts`)
- `validateGitRef` in `git:checkout`, `git:pull`, `generatePrBody`
- `flushAgentEventBatcher` at status transitions and shutdown
- Open-in-browser random filename + 5-min cleanup
- `recordTaskChangesBulk` in `updateTaskMergeableState`
- GitHub token + Supabase key encrypted via `electron.safeStorage`
- OAuth token symlink check + 64 KB size guard (`env-utils.ts`)
- `shell.openExternal` scheme allowlist (`index.ts`)
- Markdown `href` protocol validation (`render-markdown.ts`)
- `failure-classifier.ts` + `auto-merge-policy.ts` tests
- Main-process coverage thresholds in `vitest.main.config.ts`
- `claimTask` atomic WIP + status validation (IMMEDIATE transaction)
- Fast-fail-requeue calls `onTaskTerminal` (done in `run-agent.ts`)
- `maxTurns: 20` enforced + `max_turns_exceeded` abort signal
- `sprint:externalChange` 500ms debounce in `bootstrap.ts`
- `AGENT_ID_PATTERN` extracted to `lib/validation.ts`
- Agent event listener singleton guard in `agentEvents.ts`
- `batch-import` validates status via `TASK_STATUSES`
- Prompt truncation constants (all 7 constants in `prompt-constants.ts`)
- Truncation guards applied in all prompt builders
- `selectSkills` injected into assistant/adhoc agents
- Node.js version guard + onboarding GhStep + disabled Next buttons

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/main/db.ts:117` | Fix PRAGMA string interpolation |
| Modify | `src/main/agent-manager/prompt-composer-reviewer.ts` | XML-escape user content |
| Modify | `src/main/handlers/config-handlers.ts` | Validate status on `sprint:update` |
| Modify | `src/main/agent-manager/run-agent.ts` | Re-check OAuth expiry before spawn |
| Modify | `src/main/agent-manager/completion.ts` | Unify error return pattern |
| Create | `src/shared/task-statuses.ts` | Single source for all status strings |
| Modify | 4 files importing status strings | Use `task-statuses.ts` |
| Modify | `src/shared/__tests__/task-state-machine.test.ts` | Fix reverse dependency on renderer |
| Modify | `src/main/agent-manager/prompt-composer.ts` | Switch→registry OCP fix |
| Modify | `src/renderer/src/stores/dashboardEvents.ts` | Fix DashboardEvent column leakage |
| Modify | `src/main/agent-manager/prompt-composer-reviewer.ts` | Reviewer XML wrapping (Task 3 prompt-opt) |
| Modify | `src/main/agent-manager/prompt-pipeline.ts` + prompt-sections.ts | Language polish |
| Modify | `src/main/agent-manager/prompt-assistant.ts` | User memory tailoring |
| Modify | `src/main/agent-manager/index.ts` | Extract `refreshDependencyIndex` from drain loop |
| Modify | `src/main/agent-manager/drain-loop.ts` + `task-claimer.ts` | Extract drain preconditions |
| Modify | `src/main/agent-manager/run-agent.ts` | Extract `assembleRunContext` helpers |
| Modify | `src/main/services/` + handlers | Fix validateTaskSpec boundary inversion |
| Modify | `src/main/index.ts` + handlers | Inject `ISprintTaskRepository` via `AppHandlerDeps` |
| Modify | `src/main/lib/git-operations.ts` | Extract `stageWithArtifactCleanup` |

---

## Task 1: Fix SQLite PRAGMA string interpolation + reviewer XML escaping

**Files:**
- Modify: `src/main/db.ts`
- Modify: `src/main/agent-manager/prompt-composer-reviewer.ts`

### Context

**db.ts issue:** Line 117 uses `'PRAGMA user_version = ' + Math.trunc(Number(migration.version))` — string concatenation on SQL. While the value is `Math.trunc(Number(...))` so cannot be injected, this is a style violation that `better-sqlite3` supports fixing via prepared statement.

**Reviewer XML issue:** `buildStructuredReviewPrompt` and `buildInteractiveReviewPrompt` interpolate `taskContent`, `diff`, and `branch` directly into prompt strings without `escapeXmlContent()`. User-controlled content in a task spec could include `</review_context>` to escape the XML boundary. `escapeXmlContent` is already exported from `prompt-sections.ts`.

---

- [ ] **Step 1: Fix db.ts PRAGMA**

In `src/main/db.ts`, find line ~117:
```typescript
db.prepare('PRAGMA user_version = ' + Math.trunc(Number(migration.version))).run()
```
Replace with:
```typescript
const sql = `PRAGMA user_version = ${Math.trunc(Number(migration.version))}`
db.prepare(sql).run()
```
*(Note: `better-sqlite3` does not support `?` parameters for PRAGMA statements, so template literal with `Math.trunc(Number(...))` is the correct fix — it's safe because we control the value.)*

- [ ] **Step 2: Fix reviewer XML escaping**

In `src/main/agent-manager/prompt-composer-reviewer.ts`, add the import:
```typescript
import { escapeXmlContent } from '../agent-manager/prompt-sections'
```

Wait — this file IS inside `agent-manager/`, so the import is:
```typescript
import { escapeXmlContent } from './prompt-sections'
```

In `buildStructuredReviewPrompt`, replace:
```typescript
<review_context>
${taskContent}
</review_context>
```
With:
```typescript
<review_context>
${escapeXmlContent(taskContent)}
</review_context>
```

And wrap `diff` similarly:
```typescript
<review_diff>
\`\`\`diff
${escapeXmlContent(diff)}
\`\`\`
</review_diff>
```

Apply the same escaping in `buildInteractiveReviewPrompt` for any `taskContent`, `diff`, and `reviewSeed` interpolations.

- [ ] **Step 3: Run typecheck and tests**
```bash
cd ~/worktrees/BDE/fix/audit-finish
npm run typecheck
npm run test:main
```
Expected: zero errors, all tests pass

- [ ] **Step 4: Commit**
```bash
git add src/main/db.ts src/main/agent-manager/prompt-composer-reviewer.ts
git commit -m "fix: PRAGMA prepared statement; XML-escape reviewer prompt user content"
```

---

## Task 2: sprint:update handler — validate status transitions at handler layer

**Files:**
- Modify: `src/main/handlers/sprint-local.ts` (or wherever `sprint:update` is registered)

### Context

`sprint:update` IPC handler allows the renderer to set arbitrary `status` values. Transition validation exists deep in the data layer (`updateTask` calls `isValidTransition`), but a handler-layer guard provides defense-in-depth and clearer error messages at the IPC boundary.

Find the `sprint:update` handler. Add a check: if the update payload contains a `status` field, validate it is a recognized status string before calling through.

---

- [ ] **Step 1: Find and read the sprint:update handler**
```bash
cd ~/worktrees/BDE/fix/audit-finish
grep -rn "sprint:update" src/main/handlers/
```

- [ ] **Step 2: Add handler-layer status guard**

Import `TASK_STATUSES` from `'../../shared/task-state-machine'` at the top of the handler file.

In the `sprint:update` handler, before calling the update function, add:
```typescript
if (updates.status !== undefined && !(TASK_STATUSES as readonly string[]).includes(updates.status)) {
  throw new Error(`Invalid status "${updates.status}". Valid: ${TASK_STATUSES.join(', ')}`)
}
```

- [ ] **Step 3: Add test**

In the relevant handler test file, add:
```typescript
it('sprint:update rejects unrecognized status string', async () => {
  const [, handler] = getRegisteredHandler('sprint:update')
  await expect(handler({}, 'task-1', { status: 'banana' })).rejects.toThrow('Invalid status')
})
```

- [ ] **Step 4: Run tests**
```bash
npm run test:main -- src/main/handlers/__tests__/sprint-local.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**
```bash
git add src/main/handlers/sprint-local.ts  # (or whatever file was modified)
git commit -m "fix: validate status string at sprint:update handler boundary"
```

---

## Task 3: Re-check OAuth token expiry before agent spawn

**Files:**
- Modify: `src/main/agent-manager/task-claimer.ts` or `src/main/agent-manager/run-agent.ts`
- Read: `src/main/lib/env-utils.ts` (has `getOAuthToken`, `invalidateOAuthToken`)
- Read: `src/main/auth-guard.ts` (has `validateAuth`)

### Context

OAuth tokens expire. The token is read once at app startup. If the token expires during a long session, agents spawn and fail immediately with auth errors — there is no pre-flight check. This finding was F-t4-ready-ship-9 in the Apr 15 audit.

**Approach:** Before calling the SDK to spawn an agent, call `getOAuthToken()` from `env-utils.ts` and check if it returns a valid token (non-null, not expired). If the token is missing or expired, mark the task with a clear `failure_reason` instead of letting it fail mid-run.

Read `src/main/lib/env-utils.ts` to understand `getOAuthToken()` return shape and `src/main/auth-guard.ts` for token validation patterns before implementing.

---

- [ ] **Step 1: Read the relevant files**
```bash
cat src/main/lib/env-utils.ts
cat src/main/auth-guard.ts
grep -n "getOAuthToken\|TOKEN_TTL\|tokenExpired" src/main/lib/env-utils.ts
```

- [ ] **Step 2: Write failing test**

In `src/main/agent-manager/__tests__/task-claimer.test.ts` (or create it):
```typescript
it('returns BLOCKED with auth reason when OAuth token is expired', async () => {
  // mock getOAuthToken to return null or expired token
  // dispatch claimAndValidate
  // expect result.blocked === true && result.reason contains 'token'
})
```

- [ ] **Step 3: Add pre-spawn token check**

In the agent spawn path (likely `task-claimer.ts` or `run-agent.ts`), add a call to `getOAuthToken()` before spawning. If null/expired:
- Call `repo.updateTask(task.id, { status: 'error', failure_reason: 'auth', notes: 'OAuth token expired or missing. Run: claude login' })`
- Return without spawning
- Log with `logger.error`

- [ ] **Step 4: Run tests**
```bash
npm run test:main
npm run typecheck
```

- [ ] **Step 5: Commit**
```bash
git commit -m "feat: check OAuth token expiry before agent spawn; fail fast with clear error"
```

---

## Task 4: Unify error return pattern in completion.ts (Tier 1)

**Files:**
- Modify: `src/main/agent-manager/completion.ts`

### Context

`completion.ts` mixes `null`, `boolean`, `void`, and `Result<T>` returns across different functions, plus bare `catch` blocks that swallow failures. This is confusing and makes error handling inconsistent. The fix: throw-only pattern — functions throw on failure, callers handle via try/catch. Bare `catch` blocks should log via `logError(logger, ctx, err)` or rethrow.

Read `src/main/agent-manager/completion.ts` first. Identify all catch blocks. Replace `catch {}` or `catch (e) { /* nothing */ }` with `catch (err) { logger.error(...) }`. For functions with mixed return types, standardize on throwing.

---

- [ ] **Step 1: Read completion.ts**
```bash
cat src/main/agent-manager/completion.ts
```

- [ ] **Step 2: Write test for a previously-swallowed path**

Pick one catch block that currently swallows. Write a test that verifies errors are now logged.

- [ ] **Step 3: Apply fixes**

For every catch block in `completion.ts`:
- Replace bare `catch {}` → `catch (err) { logger.error('[completion] <context>:', err) }`
- Remove inconsistent null/bool/void return types — use throw-only

- [ ] **Step 4: Run tests**
```bash
npm run test:main
npm run typecheck
```

- [ ] **Step 5: Commit**
```bash
git commit -m "fix: standardize completion.ts to throw-only error pattern; log all swallowed errors"
```

---

## Task 5: Task status constants — single source of truth (Tier 1)

**Files:**
- Create: `src/shared/task-statuses.ts`
- Modify: `src/shared/task-state-machine.ts` (re-export from new file)
- Modify: files that duplicate status arrays

### Context

107+ hardcoded status strings across at least 4 files. The fix: one canonical file `src/shared/task-statuses.ts` that exports `ALL_TASK_STATUSES as const`, derives `TaskStatus` type, `TERMINAL_STATUSES`, `isTerminal()`, `isFailure()` predicates. All other files import from here.

---

- [ ] **Step 1: Find all status definition files**
```bash
grep -rn "backlog.*queued.*active\|TASK_STATUSES\|TaskStatus" src/shared/ src/main/ --include="*.ts" | grep -v test | grep -v ".d.ts"
```

- [ ] **Step 2: Create `src/shared/task-statuses.ts`**
```typescript
export const ALL_TASK_STATUSES = [
  'backlog', 'queued', 'blocked', 'active', 'review',
  'done', 'cancelled', 'failed', 'error'
] as const

export type TaskStatus = typeof ALL_TASK_STATUSES[number]

export const TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set([
  'done', 'cancelled', 'failed', 'error'
])

export function isTerminal(status: string): status is TaskStatus {
  return TERMINAL_STATUSES.has(status as TaskStatus)
}

export function isFailure(status: TaskStatus): boolean {
  return status === 'failed' || status === 'error' || status === 'cancelled'
}
```

- [ ] **Step 3: Write tests**
```typescript
import { ALL_TASK_STATUSES, isTerminal, isFailure, TERMINAL_STATUSES } from '../task-statuses'

it('ALL_TASK_STATUSES contains all 9 expected statuses', () => {
  expect(ALL_TASK_STATUSES).toHaveLength(9)
})
it('isTerminal returns true for done/cancelled/failed/error', () => {
  expect(isTerminal('done')).toBe(true)
  expect(isTerminal('queued')).toBe(false)
})
it('isFailure returns true for failed/error/cancelled', () => {
  expect(isFailure('failed')).toBe(true)
  expect(isFailure('done')).toBe(false)
})
```

- [ ] **Step 4: Update existing files to import from task-statuses.ts**

Find duplicate definitions and replace with imports from `'./task-statuses'` or `'../../shared/task-statuses'`.

- [ ] **Step 5: Run full suite**
```bash
npm run test:main && npm test && npm run typecheck
```

- [ ] **Step 6: Commit**
```bash
git commit -m "refactor: consolidate task status strings to src/shared/task-statuses.ts"
```

---

## Task 6: Fix STATUS_METADATA reverse dependency (Tier 1)

**Files:**
- Modify: `src/shared/__tests__/task-state-machine.test.ts`
- Modify: `src/renderer/src/lib/task-status-ui.ts` (or wherever STATUS_METADATA lives)
- Possibly create: `src/shared/task-status-ui-shared.ts`

### Context

`src/shared/__tests__/task-state-machine.test.ts` imports `STATUS_METADATA` and `BucketKey` from `src/renderer/src/lib/task-status-ui` — a test in `shared/` depends on a renderer module. This inverts the dependency rule (shared must never depend on renderer).

**Fix:** Move `STATUS_METADATA` and `BucketKey` to `src/shared/` so the renderer imports from shared, not the other way around. The renderer can re-export from shared for backward compatibility during migration.

---

- [ ] **Step 1: Read the files**
```bash
cat src/shared/__tests__/task-state-machine.test.ts
grep -n "STATUS_METADATA\|BucketKey" src/renderer/src/lib/task-status-ui.ts
```

- [ ] **Step 2: Move STATUS_METADATA to shared**

Create `src/shared/task-status-ui-shared.ts` with `STATUS_METADATA` and `BucketKey`.

Update `src/renderer/src/lib/task-status-ui.ts` to re-export from the shared file.

Update `src/shared/__tests__/task-state-machine.test.ts` to import from `'../task-status-ui-shared'`.

- [ ] **Step 3: Verify no circular deps**
```bash
npm run typecheck
```

- [ ] **Step 4: Run tests**
```bash
npm run test:main && npm test
```

- [ ] **Step 5: Commit**
```bash
git commit -m "refactor: move STATUS_METADATA to shared/ to fix reverse dependency in test"
```

---

## Task 7: Replace prompt-composer switch with registry (Tier 1 — OCP)

**Files:**
- Modify: `src/main/agent-manager/prompt-composer.ts` (lines 654-671)

### Context

`buildAgentPrompt()` dispatches to per-agent builders via a `switch` statement. Adding a new agent type requires modifying existing code (Open-Closed Principle violation). Replace with a `Record<AgentType, BuilderFunction>` registry.

---

- [ ] **Step 1: Read the switch block**
```bash
sed -n '640,680p' src/main/agent-manager/prompt-composer.ts
```

- [ ] **Step 2: Write a test that would pass with either implementation** (to verify no regression)
```typescript
it('buildAgentPrompt dispatches to correct builder for each agent type', () => {
  const types: AgentType[] = ['pipeline', 'assistant', 'adhoc', 'copilot', 'synthesizer']
  for (const agentType of types) {
    expect(() => buildAgentPrompt({ agentType })).not.toThrow()
  }
})
```

- [ ] **Step 3: Replace switch with registry**

```typescript
type BuilderFn = (input: BuildPromptInput) => string

const PROMPT_BUILDERS: Record<AgentType, BuilderFn> = {
  pipeline: buildPipelinePrompt,
  assistant: buildAssistantPrompt,
  adhoc: buildAdhocPrompt,
  copilot: buildCopilotPrompt,
  synthesizer: buildSynthesizerPrompt,
}

export function buildAgentPrompt(input: BuildPromptInput): string {
  const builder = PROMPT_BUILDERS[input.agentType]
  if (!builder) throw new Error(`Unknown agent type: ${input.agentType}`)
  return builder(input)
}
```

- [ ] **Step 4: Run tests**
```bash
npm run test:main -- src/main/__tests__/prompt-composer.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**
```bash
git commit -m "refactor: replace prompt-composer switch with builder registry (OCP)"
```

---

## Task 8: Fix DashboardEvent column leakage (Tier 1)

**Files:**
- Modify: wherever `DashboardEvent` is shaped before being sent to renderer
- Read: `src/renderer/src/stores/` (find which store consumes dashboard events)

### Context

`DashboardEvent` exposes `agent_id`, `event_type` (raw snake_case DB columns) and raw JSON `payload` string to the renderer. The fix: transform at the data boundary — parse `payload`, rename to camelCase — following the `rowToRecord` pattern in `cost-queries.ts`.

---

- [ ] **Step 1: Find DashboardEvent type and its data boundary**
```bash
grep -rn "DashboardEvent\|agent_id.*event_type" src/shared/ src/main/data/ --include="*.ts" | head -20
grep -rn "dashboardEvents\|dashboard:events" src/main/ src/renderer/ --include="*.ts" | head -10
```

- [ ] **Step 2: Create a mapper function**

At the data boundary (IPC handler or query), add:
```typescript
function toDashboardEvent(row: RawDashboardEventRow): DashboardEvent {
  return {
    agentId: row.agent_id,
    eventType: row.event_type,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    // ... other fields
  }
}
```

- [ ] **Step 3: Update DashboardEvent type in shared types**

Change snake_case fields to camelCase in the type definition. Update all consumer call sites.

- [ ] **Step 4: Run tests**
```bash
npm test && npm run test:main && npm run typecheck
```

- [ ] **Step 5: Commit**
```bash
git commit -m "refactor: transform DashboardEvent to camelCase + parse payload at data boundary"
```

---

## Task 9: Prompt optimization — user memory tailoring + language polish

**Files:**
- Modify: `src/main/agent-manager/prompt-assistant.ts` (user memory tailoring)
- Modify: `src/main/agent-manager/prompt-pipeline.ts` (language polish)
- Modify: `src/main/agent-manager/prompt-sections.ts` (buildRetryContext language)

### Context

From `2026-04-13-prompt-system-optimization.md`, Tasks 5-6. Task 5 adds user memory tailoring to assistant/adhoc agents. Task 6 polishes 5 specific phrases in the pipeline prompt that are wordy or contradictory.

Read the plan before starting:
```bash
cat docs/superpowers/plans/2026-04-13-prompt-system-optimization.md
```
Implement Tasks 5 and 6 exactly as written in that plan.

---

- [ ] **Step 1: Read plan Tasks 5 and 6 in full**
```bash
sed -n '661,930p' docs/superpowers/plans/2026-04-13-prompt-system-optimization.md
```

- [ ] **Step 2: Implement Task 5 (User Memory Tailoring) per plan**

- [ ] **Step 3: Implement Task 6 (Pipeline Language Polish) per plan**

- [ ] **Step 4: Run tests**
```bash
npm run test:main && npm run typecheck
```

- [ ] **Step 5: Commit**
```bash
git commit -m "feat: user memory tailoring for assistant agents; pipeline language polish"
```

---

## Task 10: Prompt optimization — output format guidance + misc consistency (Tasks 7–8)

**Files:** Per `2026-04-13-prompt-system-optimization.md` Tasks 7 and 8.

Read the plan for exact file paths and test code:
```bash
sed -n '997,1100p' docs/superpowers/plans/2026-04-13-prompt-system-optimization.md
```

Implement Tasks 7 and 8 exactly as written. Run `npm run test:main` and commit.

---

- [ ] **Step 1: Read Tasks 7 and 8 from plan**
- [ ] **Step 2: Implement Task 7 (Output Format Guidance)**
- [ ] **Step 3: Implement Task 8 (Misc Consistency)**
- [ ] **Step 4: Run tests + typecheck**
- [ ] **Step 5: Commit**
```bash
git commit -m "feat: output format guidance + misc prompt consistency (Tasks 7-8)"
```

---

## Task 11: Extract `refreshDependencyIndex` from drain loop (Clean Code Task 1)

**Files:** Per `2026-04-13-clean-code-orchestration.md` Task 1.

Read the plan for the exact extraction target:
```bash
sed -n '84,213p' docs/superpowers/plans/2026-04-13-clean-code-orchestration.md
```

The ~50-line inline block in `_drainLoop()` at `src/main/agent-manager/index.ts:418–459` should be extracted to `src/main/agent-manager/dependency-refresher.ts` as `refreshDependencyIndex(repo, logger)`. Follow the plan exactly.

---

- [ ] **Step 1: Read Task 1 from plan**
- [ ] **Step 2: Write test first (TDD)**
- [ ] **Step 3: Extract the function**
- [ ] **Step 4: Run tests**
```bash
npm run test:main && npm run typecheck
```
- [ ] **Step 5: Commit**
```bash
git commit -m "refactor: extract refreshDependencyIndex from _drainLoop"
```

---

## Task 12: Extract drain preconditions + assembleRunContext helpers (Clean Code Tasks 2–3)

**Files:** Per `2026-04-13-clean-code-orchestration.md` Tasks 2 and 3.

Read the plan:
```bash
sed -n '213,512p' docs/superpowers/plans/2026-04-13-clean-code-orchestration.md
```

Implement Tasks 2 and 3 in sequence. Task 2 extracts drain precondition checks and task iteration helpers. Task 3 extracts `fetchUpstreamContext()` and `readPriorScratchpad()` from `assembleRunContext()` in `run-agent.ts`. Follow the plan exactly for each.

---

- [ ] **Step 1: Read Tasks 2 and 3 from plan**
- [ ] **Step 2: Implement Task 2 (drain preconditions)**
- [ ] **Step 3: Implement Task 3 (assembleRunContext helpers)**
- [ ] **Step 4: Run tests**
```bash
npm run test:main && npm run typecheck
```
- [ ] **Step 5: Commit each separately per plan commit messages**

---

## Task 13: Fix module boundary + DI injection (Clean Code Tasks 4–5)

**Files:** Per `2026-04-13-clean-code-orchestration.md` Tasks 4 and 5.

Read the plan:
```bash
sed -n '512,815p' docs/superpowers/plans/2026-04-13-clean-code-orchestration.md
```

Task 4 moves `validateTaskSpec` to the service layer (currently in a handler). Task 5 adds `repo: ISprintTaskRepository` to `AppHandlerDeps` so 3 handlers stop constructing their own repositories. These are sequentially dependent — do Task 4 first.

---

- [ ] **Step 1: Read Tasks 4 and 5 from plan**
- [ ] **Step 2: Implement Task 4 (validateTaskSpec boundary)**
- [ ] **Step 3: Implement Task 5 (DI injection)**
- [ ] **Step 4: Run full test suite**
```bash
npm run test:main && npm test && npm run typecheck
```
- [ ] **Step 5: Commit each separately**

---

## Task 14: Extract `stageWithArtifactCleanup` (Clean Code Task 6)

**Files:** Per `2026-04-13-clean-code-orchestration.md` Task 6.

Read the plan:
```bash
sed -n '815,930p' docs/superpowers/plans/2026-04-13-clean-code-orchestration.md
```

`autoCommitIfDirty()` in `git-operations.ts:403` has ~45 lines of staging + artifact cleanup inline. Extract to `stageWithArtifactCleanup(worktreePath, logger)`. Follow the plan exactly.

---

- [ ] **Step 1: Read Task 6 from plan**
- [ ] **Step 2: Write failing test**
- [ ] **Step 3: Extract function**
- [ ] **Step 4: Run tests**
```bash
npm run test:main && npm run typecheck
```
- [ ] **Step 5: Commit**
```bash
git commit -m "refactor: extract stageWithArtifactCleanup from autoCommitIfDirty"
```

---

## Cleanup: Delete old plan files

After all tasks are merged, delete the superseded plan files:

```bash
rm docs/superpowers/plans/2026-04-13-clean-code-orchestration.md
rm docs/superpowers/plans/2026-04-13-prompt-system-optimization.md
rm docs/superpowers/plans/2026-04-15-credential-storage-hardening.md
git add -A docs/superpowers/plans/
git commit -m "chore: remove superseded plan files — consolidated into finish-all-audit-findings"
```
