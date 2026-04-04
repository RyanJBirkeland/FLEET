# Security Audit & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate BDE's network surface (Queue API), fix a path traversal vulnerability, and remediate dependency vulnerabilities for professional use readiness.

**Architecture:** Remove the HTTP server entirely (no port binding), relocate shared types that survive the deletion, add path boundary validation to the playground handler, and run `npm audit fix`.

**Tech Stack:** Electron, TypeScript, Node.js, Vitest

**Spec:** `docs/superpowers/specs/2026-04-03-security-audit-hardening-design.md`

---

## File Structure

### Files to Delete

- `src/main/queue-api/` (entire directory — 9 production + 3 test files)
- `src/shared/queue-api-contract.ts`
- `src/main/__tests__/integration/queue-api-integration.test.ts`
- `src/main/__tests__/integration/queue-api-sse.test.ts`
- `src/main/__tests__/integration/queue-api-auth.test.ts`

### Files to Modify

- `src/shared/types.ts` — receive relocated types (`TaskOutputEvent`, `BatchOperation`, `BatchResult`, `GENERAL_PATCH_FIELDS`)
- `src/shared/ipc-channels.ts:29` — update import path
- `src/main/index.ts:30,41,129,140-141` — remove Queue API lifecycle
- `src/main/handlers/sprint-listeners.ts:8,38-44` — remove SSE broadcasting
- `src/renderer/src/stores/sprintEvents.ts:2` — update import path
- `src/renderer/src/stores/__tests__/sprintEvents.test.ts` — update import path
- `src/main/handlers/sprint-local.ts:382` — update GENERAL_PATCH_FIELDS import path
- `src/main/handlers/playground-handlers.ts` — add path validation
- `src/shared/ipc-channels.ts:518-521` — update playground channel signature
- `src/main/agent-system/skills/task-orchestration.ts` — remove Queue API guidance
- `src/main/agent-system/skills/debugging.ts` — remove Queue API guidance
- `src/main/agent-system/skills/__tests__/skills.test.ts` — remove queue-api-call assertions
- `src/main/handlers/__tests__/sprint-local.test.ts:91` — remove sseBroadcaster mock
- `src/main/handlers/__tests__/sprint-listeners.test.ts:5-8` — remove sseBroadcaster mock
- `src/main/services/__tests__/sprint-service.test.ts:33-34` — remove sseBroadcaster mock
- `CLAUDE.md`, `docs/BDE_FEATURES.md`, `docs/architecture.md`, `docs/agent-system-guide.md` — remove Queue API references

---

### Task 1: Relocate Shared Types from queue-api-contract.ts

Some types in `queue-api-contract.ts` are used outside the Queue API. Move them to `src/shared/types.ts` before deleting the contract file.

**Files:**

- Modify: `src/shared/types.ts` (append types)
- Modify: `src/shared/ipc-channels.ts:29` (update import)
- Modify: `src/renderer/src/stores/sprintEvents.ts:2` (update import)
- Modify: `src/renderer/src/stores/__tests__/sprintEvents.test.ts` (update import)

- [ ] **Step 1: Add relocated types to `src/shared/types.ts`**

Append these types from `queue-api-contract.ts` to the end of `src/shared/types.ts`:

```typescript
// --- Batch Operation Types (relocated from queue-api-contract.ts) ---

export interface BatchOperation {
  op: 'update' | 'delete'
  id: string
  patch?: Record<string, unknown>
}

export interface BatchResult {
  id: string
  op: 'update' | 'delete'
  ok: boolean
  error?: string
}

// Field allowlist for general task updates (relocated from queue-api-contract.ts)
export const GENERAL_PATCH_FIELDS = new Set([
  'title',
  'prompt',
  'repo',
  'spec',
  'notes',
  'priority',
  'templateName',
  'playgroundEnabled',
  'maxRuntimeMs'
])

// --- Task Output Event Types (relocated from queue-api-contract.ts) ---

export type TaskOutputEventType =
  | 'agent:started'
  | 'agent:tool_call'
  | 'agent:tool_result'
  | 'agent:thinking'
  | 'agent:rate_limited'
  | 'agent:error'
  | 'agent:completed'

export interface TaskOutputEvent {
  taskId: string
  timestamp: string
  type: TaskOutputEventType | string
}
```

- [ ] **Step 2: Update import in `src/shared/ipc-channels.ts:29`**

Replace:

```typescript
import type { BatchOperation, BatchResult } from './queue-api-contract'
```

With:

```typescript
import type { BatchOperation, BatchResult } from './types'
```

- [ ] **Step 3: Update import in `src/renderer/src/stores/sprintEvents.ts:2`**

Replace:

```typescript
import type { TaskOutputEvent } from '../../../shared/queue-api-contract'
```

With:

```typescript
import type { TaskOutputEvent } from '../../../shared/types'
```

- [ ] **Step 4: Update import in `src/renderer/src/stores/__tests__/sprintEvents.test.ts`**

Update the `TaskOutputEvent` import to point to `../../../../shared/types` instead of `../../../../shared/queue-api-contract`.

- [ ] **Step 5: Update dynamic import in `src/main/handlers/sprint-local.ts:382`**

Replace:

```typescript
const { GENERAL_PATCH_FIELDS } = await import('../../shared/queue-api-contract')
```

With:

```typescript
const { GENERAL_PATCH_FIELDS } = await import('../../shared/types')
```

- [ ] **Step 6: Run typecheck to verify imports resolve**

Run: `npm run typecheck`
Expected: PASS (no errors related to missing types)

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/shared/ipc-channels.ts src/renderer/src/stores/sprintEvents.ts src/renderer/src/stores/__tests__/sprintEvents.test.ts src/main/handlers/sprint-local.ts
git commit -m "chore: relocate shared types from queue-api-contract to types.ts"
```

---

### Task 2: Remove Queue API Server Lifecycle from Main Process

**Files:**

- Modify: `src/main/index.ts:30,41,129,140-141`

- [ ] **Step 1: Remove Queue API imports from `src/main/index.ts`**

Remove these two import lines:

```typescript
import { startQueueApi, stopQueueApi } from './queue-api'
```

(line 30)

```typescript
import { setQueueApiOnStatusTerminal } from './queue-api/task-handlers'
```

(line 41)

- [ ] **Step 2: Remove Queue API lifecycle calls from `src/main/index.ts`**

Remove these three lines:

```typescript
setQueueApiOnStatusTerminal(terminalService.onStatusTerminal)
```

(line 129)

```typescript
startQueueApi({ port: 18790 })
app.on('will-quit', () => stopQueueApi())
```

(lines 140-141)

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (Queue API files still exist but are unreferenced)

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts
git commit -m "chore: remove Queue API server startup and lifecycle from main process"
```

---

### Task 3: Remove SSE Broadcasting from Sprint Listeners

**Files:**

- Modify: `src/main/handlers/sprint-listeners.ts`

- [ ] **Step 1: Remove sseBroadcaster import and usage**

In `src/main/handlers/sprint-listeners.ts`, remove line 8:

```typescript
import { sseBroadcaster } from '../queue-api/router'
```

And remove lines 38-45 (the SSE broadcast block inside `notifySprintMutation`):

```typescript
sseBroadcaster.broadcast('task:updated', { id: task.id, status: task.status })
if (task.status === 'queued') {
  sseBroadcaster.broadcast('task:queued', {
    id: task.id,
    title: task.title,
    priority: task.priority
  })
}
```

Keep the IPC broadcast to renderer windows (lines 47-50) — that's internal, not network.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/handlers/sprint-listeners.ts
git commit -m "chore: remove SSE broadcasting from sprint mutation listener"
```

---

### Task 4: Remove sseBroadcaster Mocks from Test Files

**Files:**

- Modify: `src/main/handlers/__tests__/sprint-local.test.ts:91`
- Modify: `src/main/handlers/__tests__/sprint-listeners.test.ts:5-8`
- Modify: `src/main/services/__tests__/sprint-service.test.ts:33-34`

- [ ] **Step 1: Remove mock from `sprint-local.test.ts`**

Remove the `vi.mock` block for `queue-api/router` (~line 91):

```typescript
vi.mock('../../queue-api/router', () => ({
  sseBroadcaster: { broadcast: vi.fn() }
}))
```

- [ ] **Step 2: Remove mock from `sprint-listeners.test.ts`**

Remove the `vi.mock` block for `queue-api/router` (~lines 5-8):

```typescript
vi.mock('../../queue-api/router', () => ({
  sseBroadcaster: { broadcast: vi.fn() }
}))
```

Also remove any test assertions that verify `sseBroadcaster.broadcast` was called.

- [ ] **Step 3: Remove mock from `sprint-service.test.ts`**

Remove the `vi.mock` block for `queue-api/router` (~lines 33-34):

```typescript
vi.mock('../../queue-api/router', () => ({
  sseBroadcaster: { broadcast: vi.fn() }
}))
```

- [ ] **Step 4: Run affected tests**

Run: `npm run test:main`
Expected: PASS (mocks removed, no more references to deleted module)

- [ ] **Step 5: Commit**

```bash
git add src/main/handlers/__tests__/sprint-local.test.ts src/main/handlers/__tests__/sprint-listeners.test.ts src/main/services/__tests__/sprint-service.test.ts
git commit -m "chore: remove sseBroadcaster mocks from test files"
```

---

### Task 5: Remove Queue API from Agent System Skills

Must happen before deleting queue-api files — these files have hardcoded Queue API URLs and capability strings that would confuse agents.

**Files:**

- Modify: `src/main/agent-system/skills/task-orchestration.ts`
- Modify: `src/main/agent-system/skills/debugging.ts`
- Modify: `src/main/agent-system/skills/__tests__/skills.test.ts`

- [ ] **Step 1: Remove Queue API section from task-orchestration.ts**

Read the file. Find and remove:

- The "Queue API Alternative" section (~lines 47-62) containing `http://localhost:18790/queue/tasks` URLs and curl examples
- `'queue-api-call'` from the skill's capabilities array (~line 64)

- [ ] **Step 2: Remove Queue API section from debugging.ts**

Read the file. Find and remove:

- The curl example referencing `http://localhost:18790/queue/tasks/<id>/status` (~line 26)
- `'queue-api-call'` from the skill's capabilities array (~line 44)

- [ ] **Step 3: Update skills test assertions**

In `skills/__tests__/skills.test.ts`, remove assertions for `queue-api-call` capability (~lines 46, 63). Update any capability count assertions that may break.

- [ ] **Step 4: Run tests**

```bash
npm run test:main
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/agent-system/skills/task-orchestration.ts src/main/agent-system/skills/debugging.ts src/main/agent-system/skills/__tests__/skills.test.ts
git commit -m "chore: remove Queue API references from agent system skills"
```

---

### Task 6: Delete Queue API Files

All references have been removed in Tasks 1-5. Now safe to delete.

**Files:**

- Delete: `src/main/queue-api/` (entire directory)
- Delete: `src/shared/queue-api-contract.ts`
- Delete: `src/main/__tests__/integration/queue-api-integration.test.ts`
- Delete: `src/main/__tests__/integration/queue-api-sse.test.ts`
- Delete: `src/main/__tests__/integration/queue-api-auth.test.ts`

- [ ] **Step 1: Delete all Queue API files**

```bash
rm -rf src/main/queue-api/
rm src/shared/queue-api-contract.ts
rm src/main/__tests__/integration/queue-api-integration.test.ts
rm src/main/__tests__/integration/queue-api-sse.test.ts
rm src/main/__tests__/integration/queue-api-auth.test.ts
```

- [ ] **Step 2: Verify no remaining references**

```bash
grep -r "queue-api\|queue-api-contract\|startQueueApi\|stopQueueApi\|sseBroadcaster" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: No files returned. If any appear, fix them before proceeding.

- [ ] **Step 3: Run full typecheck and tests**

```bash
npm run typecheck && npm test && npm run test:main
```

Expected: All PASS.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git rm -r src/main/queue-api/ src/shared/queue-api-contract.ts src/main/__tests__/integration/queue-api-integration.test.ts src/main/__tests__/integration/queue-api-sse.test.ts src/main/__tests__/integration/queue-api-auth.test.ts
git commit -m "chore: delete Queue API server, contract types, and integration tests

Removes the HTTP server on port 18790, eliminating all network surface
from BDE. Task management now happens exclusively through IPC."
```

---

### Task 7: Fix Playground Path Traversal Vulnerability

`playground:show` is a main-process-only IPC handler — it is NOT exposed in the preload bridge and has no renderer call sites. It's only invoked internally. The fix adds path boundary validation matching the `ide-fs-handlers.ts` pattern.

**Files:**

- Modify: `src/main/handlers/playground-handlers.ts`
- Modify: `src/shared/ipc-channels.ts:518-521`
- Create: `src/main/handlers/__tests__/playground-handlers.test.ts`

- [ ] **Step 1: Write failing test for path traversal blocking**

Create `src/main/handlers/__tests__/playground-handlers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies — paths relative to playground-handlers.ts location
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('<html></html>'),
  stat: vi.fn().mockResolvedValue({ size: 100 })
}))
vi.mock('fs', () => ({
  realpathSync: vi.fn((p: string) => p)
}))
vi.mock('../broadcast', () => ({
  broadcast: vi.fn()
}))
vi.mock('../ipc-utils', () => ({
  safeHandle: vi.fn((channel: string, handler: Function) => {
    ;(globalThis as any).__playgroundHandler = handler
  })
}))

import { registerPlaygroundHandlers } from '../playground-handlers'

describe('playground-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerPlaygroundHandlers()
  })

  it('blocks path traversal outside allowed root', async () => {
    const handler = (globalThis as any).__playgroundHandler
    await expect(
      handler(null, {
        filePath: '/tmp/worktree/../../etc/passwd.html',
        rootPath: '/tmp/worktree'
      })
    ).rejects.toThrow(/path traversal blocked/i)
  })

  it('rejects when rootPath is missing', async () => {
    const handler = (globalThis as any).__playgroundHandler
    await expect(handler(null, { filePath: '/tmp/test.html', rootPath: '' })).rejects.toThrow(
      /rootPath is required/i
    )
  })

  it('allows valid path within root', async () => {
    const handler = (globalThis as any).__playgroundHandler
    await expect(
      handler(null, {
        filePath: '/tmp/worktree/output.html',
        rootPath: '/tmp/worktree'
      })
    ).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/handlers/__tests__/playground-handlers.test.ts`
Expected: FAIL — handler doesn't accept `rootPath` yet

- [ ] **Step 3: Update IPC channel signature**

In `src/shared/ipc-channels.ts:518-521`, change:

```typescript
  'playground:show': {
    args: [input: { filePath: string }]
    result: void
  }
```

To:

```typescript
  'playground:show': {
    args: [input: { filePath: string; rootPath: string }]
    result: void
  }
```

- [ ] **Step 4: Add path validation to playground-handlers.ts**

Replace the full file `src/main/handlers/playground-handlers.ts`:

```typescript
/**
 * Dev Playground IPC handlers — validates and broadcasts HTML preview files
 * to renderer for inline display in agent chat.
 */
import { readFile, stat } from 'fs/promises'
import { extname, basename, resolve } from 'path'
import { realpathSync } from 'fs'
import { safeHandle } from '../ipc-utils'
import { broadcast } from '../broadcast'
import type { AgentEvent } from '../../shared/types'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function registerPlaygroundHandlers(): void {
  safeHandle('playground:show', async (_e, input: { filePath: string; rootPath: string }) => {
    const { filePath, rootPath } = input

    if (!rootPath) {
      throw new Error('rootPath is required for playground file access')
    }

    // Resolve symlinks and enforce path boundary (same pattern as ide-fs-handlers.ts)
    let resolvedRoot: string
    try {
      resolvedRoot = realpathSync(resolve(rootPath))
    } catch {
      resolvedRoot = resolve(rootPath)
    }

    let resolvedPath: string
    try {
      resolvedPath = realpathSync(resolve(filePath))
    } catch {
      resolvedPath = resolve(filePath)
    }

    if (!resolvedPath.startsWith(resolvedRoot + '/') && resolvedPath !== resolvedRoot) {
      throw new Error(`Path traversal blocked: "${filePath}" is outside root "${rootPath}"`)
    }

    // Validate .html extension
    if (extname(resolvedPath).toLowerCase() !== '.html') {
      throw new Error(`Invalid file type: only .html files are supported (got: ${filePath})`)
    }

    // Check file size before reading
    const stats = await stat(resolvedPath)
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
      )
    }

    // Read file content
    const html = await readFile(resolvedPath, 'utf-8')
    const filename = basename(resolvedPath)

    const event: AgentEvent = {
      type: 'agent:playground',
      filename,
      html,
      sizeBytes: stats.size,
      timestamp: Date.now()
    }

    broadcast('agent:event', { agentId: 'playground', event })
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/main/handlers/__tests__/playground-handlers.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

```bash
npm run typecheck && npm test && npm run test:main
```

Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/main/handlers/playground-handlers.ts src/shared/ipc-channels.ts src/main/handlers/__tests__/playground-handlers.test.ts
git commit -m "fix: add path traversal prevention to playground:show handler

Validates filePath is within rootPath using symlink-aware boundary
check, matching the pattern used by ide-fs-handlers.ts."
```

---

### Task 8: Remediate Dependency Vulnerabilities

**Files:**

- Modify: `package-lock.json` (via npm audit fix)

- [ ] **Step 1: Run npm audit fix (safe, non-breaking)**

```bash
npm audit fix
```

Expected: Resolves xmldom, flatted, lodash, picomatch, brace-expansion, electron vulnerabilities.

- [ ] **Step 2: Verify BDE's own DOMPurify is patched**

```bash
npm ls dompurify
```

Expected: BDE's direct `dompurify` dependency should be >=3.3.2. Monaco's nested copy may still be vulnerable (accepted risk — Monaco uses it internally for editor rendering, not user content).

- [ ] **Step 3: Run full verification**

```bash
npm run typecheck && npm test && npm run test:main && npm run lint
```

Expected: All PASS

- [ ] **Step 4: Run npm audit to confirm remaining state**

```bash
npm audit
```

Expected: 0 high vulnerabilities. Moderate DOMPurify in Monaco accepted.

- [ ] **Step 5: Commit**

```bash
git add package-lock.json package.json
git commit -m "chore: remediate high-severity dependency vulnerabilities

npm audit fix resolves: xmldom (XML injection), flatted (prototype
pollution), lodash (code injection), picomatch (ReDoS), brace-expansion
(process hang), electron (3 moderate issues)."
```

---

### Task 9: Documentation Cleanup

**Files:**

- Modify: `CLAUDE.md`
- Modify: `docs/BDE_FEATURES.md`
- Modify: `docs/architecture.md`
- Modify: `docs/agent-system-guide.md`
- Modify: `~/CLAUDE.md` (global)

- [ ] **Step 0: Verify no Settings UI or task-terminal-service references remain**

```bash
grep -r "taskRunner.apiKey\|getOrCreateApiKey" src/ --include="*.ts" --include="*.tsx" -l
grep -r "queue-api\|queueApi" src/main/services/task-terminal-service.ts
```

Expected: No files returned. If any appear, remove the references before proceeding.

Also verify `runner-client.ts` does NOT import from queue-api (known to be independent — outbound client to separate service, accepted as out of scope):

```bash
grep "queue-api" src/main/runner-client.ts
```

Expected: No output.

- [ ] **Step 1: Remove Queue API references from `CLAUDE.md`**

Search for and remove all mentions of:

- Queue API, port 18790, SSE broadcaster, `queue-api/` paths
- `taskRunner.apiKey`, `getOrCreateApiKey`
- `GENERAL_PATCH_FIELDS`, `MAX_ACTIVE_TASKS` (where referencing Queue API enforcement)
- Gotchas about Queue API auth bootstrapping, endpoints, bulk task creation
- "Two writers to sprint_tasks" → update to "one writer" (SQLite via IPC)
- Integration test references to queue-api test files
- `task-handlers.ts` references in key file locations

Update the architecture notes to reflect that task management is IPC-only (no HTTP surface).

- [ ] **Step 2: Remove Queue API from `docs/BDE_FEATURES.md`**

- Remove the Queue API feature section (the full "### Queue API" section)
- Update task lifecycle step 2: tasks enter pipeline via BDE UI, not external API
- Remove Queue API from all "Related:" links
- Remove WIP limit Queue API enforcement note from Agent Manager section

- [ ] **Step 3: Update `docs/architecture.md`**

- Remove Queue API module section, port 18790, SSE server references
- Remove `TaskQueueAPI` from architecture diagrams
- Update data flow to show IPC-only task management

- [ ] **Step 4: Update `docs/agent-system-guide.md`**

- Remove `queue-api-call` from skill capability table
- Remove any references to Queue API as an agent interaction method

- [ ] **Step 5: Update global `~/CLAUDE.md`**

- Remove "Serves Queue API on port 18790" from BDE project description
- Update cross-repo contracts: remove "Two writers to sprint_tasks"
- Note that Life OS, claude-chat-service, claude-task-runner no longer have a BDE integration point

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/BDE_FEATURES.md docs/architecture.md docs/agent-system-guide.md ~/CLAUDE.md
git commit -m "docs: remove all Queue API references after server removal"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Verify no port binding**

```bash
npm run build && lsof -i :18790
```

Expected: No output from lsof — nothing listening on 18790.

- [ ] **Step 2: Run full CI checks**

```bash
npm run typecheck && npm test && npm run test:main && npm run lint
```

Expected: All PASS

- [ ] **Step 3: Verify npm audit**

```bash
npm audit
```

Expected: 0 high vulnerabilities

- [ ] **Step 4: Search for any remaining queue-api references in source**

```bash
grep -r "queue-api\|18790\|startQueueApi\|stopQueueApi\|sseBroadcaster\|queue-api-contract" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: No files returned

- [ ] **Step 5: Commit verification results (if any fixes needed)**

If any issues found in steps 1-4, fix them and commit. Otherwise, no commit needed.
