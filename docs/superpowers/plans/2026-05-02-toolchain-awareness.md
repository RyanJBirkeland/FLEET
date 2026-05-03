# Per-Repo Toolchain Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two pipeline failure modes for non-FLEET repos: (1) `node_modules/.bin` not on PATH during verification and agent spawn, causing `turbo: command not found`; (2) no pre-flight check for required toolchain binaries before spawning an agent, causing expensive retries on environmental failures.

**Architecture:** A new `buildWorktreeEnv(worktreePath)` function in `env-utils.ts` prepends `<worktree>/node_modules/.bin` to the agent spawn and verification gate envs. A new `preflight-check.ts` module auto-detects toolchain from repo signals and probes required binaries; `preflight-gate.ts` manages the IPC request-response lifecycle when binaries are missing. The drain loop (`task-claimer.ts`) runs pre-flight inside `processQueuedTask` before claiming, gated behind a modal the user confirms or cancels.

**Tech Stack:** TypeScript, Node.js `execFileAsync`, Vitest, React/Zustand, Electron IPC (preload bridge pattern)

**Spec:** `docs/superpowers/specs/2026-05-02-toolchain-awareness-design.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/main/agent-manager/preflight-check.ts` | `detectToolchain` + `runPreflightChecks` |
| `src/main/agent-manager/preflight-gate.ts` | Pending-confirmation promise map, timeout, broadcast |
| `src/main/agent-manager/__tests__/preflight-check.test.ts` | Unit tests for detection and probing |
| `src/main/agent-manager/__tests__/preflight-gate.test.ts` | Unit tests for gate promise lifecycle |
| `src/renderer/src/stores/preflightStore.ts` | Queue of pending preflight warnings |
| `src/renderer/src/components/sprint/PreflightWarningModal.tsx` | Warning modal UI |

### Modified files
| File | Change |
|---|---|
| `src/main/env-utils.ts` | Add `buildWorktreeEnv(worktreePath)` |
| `src/main/agent-manager/verify-worktree.ts` | `execFileRunCommand` uses `buildWorktreeEnv(cwd)` |
| `src/main/agent-manager/sdk-adapter.ts` | Add `worktreePath?` to `spawnClaudeAgent`, `spawnAgent`, `spawnWithTimeout` |
| `src/main/agent-manager/spawn-and-wire.ts` | Pass `worktree.worktreePath` to `spawnWithTimeout` |
| `src/main/agent-manager/task-claimer.ts` | Add `preflightGate` to `ProcessQueuedTaskDeps`; run pre-flight in `processQueuedTask` |
| `src/main/agent-manager/index.ts` | Create `PreflightGate`, wire into `_processQueuedTask` deps |
| `src/shared/ipc-channels/broadcast-channels.ts` | Add `agent:preflightWarning` |
| `src/shared/ipc-channels/agent-channels.ts` | Add `agent:preflightResponse` |
| `src/preload/api-agents.ts` | Add `onPreflightWarning` broadcast subscription |
| `src/preload/index.d.ts` | Type `onPreflightWarning` + `preflightResponse` |
| `src/main/handlers/agent-handlers.ts` | `safeHandle('agent:preflightResponse', ...)` |
| `src/renderer/src/App.tsx` | Mount `<PreflightWarningModal />` |
| `src/renderer/src/test-setup.ts` | Mock new API methods |

---

## Task 1: `buildWorktreeEnv` in env-utils

**Files:**
- Modify: `src/main/env-utils.ts`
- Test: `src/main/__tests__/env-utils.test.ts` (already exists — add to it)

- [ ] **Step 1: Write failing tests**

Open `src/main/__tests__/env-utils.test.ts` and add at the end:

```typescript
describe('buildWorktreeEnv', () => {
  beforeEach(() => {
    _resetEnvCache()
    vi.restoreAllMocks()
  })

  it('prepends node_modules/.bin to PATH when it exists', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) =>
      String(p).endsWith('node_modules/.bin') ? true : existsSyncReal(p)
    )
    const env = buildWorktreeEnv('/repo/worktree')
    expect(env.PATH).toMatch(/^\/repo\/worktree\/node_modules\/.bin:/)
  })

  it('returns base env unchanged when node_modules/.bin does not exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    const base = buildAgentEnv()
    const env = buildWorktreeEnv('/repo/worktree')
    expect(env.PATH).toBe(base.PATH)
  })

  it('does not mutate the cached base env', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    const base = buildAgentEnv()
    const originalPath = base.PATH
    buildWorktreeEnv('/repo/worktree')
    expect(buildAgentEnv().PATH).toBe(originalPath)
  })
})
```

You'll need to import `buildWorktreeEnv` and capture a reference to the real `existsSync` before mocking:
```typescript
import { buildAgentEnv, buildWorktreeEnv, _resetEnvCache } from '../env-utils'
import * as fs from 'node:fs'
const existsSyncReal = fs.existsSync
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --run src/main/__tests__/env-utils.test.ts
```
Expected: FAIL — `buildWorktreeEnv is not a function`

- [ ] **Step 3: Implement `buildWorktreeEnv`**

In `src/main/env-utils.ts`, add after the `buildAgentEnv` function:

```typescript
/**
 * Like buildAgentEnv but prepends <worktreePath>/node_modules/.bin to PATH
 * when that directory exists. Fixes "turbo: command not found" in repos where
 * node_modules is a symlink and npm's workspace-root detection does not
 * augment PATH reliably.
 *
 * Not cached — each call site supplies its own worktreePath.
 */
export function buildWorktreeEnv(worktreePath: string): Record<string, string | undefined> {
  const base = buildAgentEnv()
  const binDir = join(worktreePath, 'node_modules', '.bin')
  if (!existsSync(binDir)) return base
  const current = base.PATH ?? ''
  return { ...base, PATH: [binDir, ...current.split(':').filter(Boolean)].join(':') }
}
```

(`join` and `existsSync` are already imported at the top of this file.)

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --run src/main/__tests__/env-utils.test.ts
```
Expected: all `buildWorktreeEnv` tests pass

- [ ] **Step 5: Commit**

```bash
git add src/main/env-utils.ts src/main/__tests__/env-utils.test.ts
git commit -m "feat(env): add buildWorktreeEnv to prepend node_modules/.bin per-worktree"
```

---

## Task 2: Use `buildWorktreeEnv` in the verification gate

**Files:**
- Modify: `src/main/agent-manager/verify-worktree.ts` (line 196)
- Test: `src/main/agent-manager/__tests__/verify-worktree.test.ts`

- [ ] **Step 1: Write failing test**

In `src/main/agent-manager/__tests__/verify-worktree.test.ts`, add a new describe block after the existing ones:

```typescript
describe('execFileRunCommand uses buildWorktreeEnv', () => {
  it('calls buildWorktreeEnv with the cwd when running a real command', async () => {
    vi.mock('../../env-utils', async (importOriginal) => {
      const real = await importOriginal<typeof import('../../env-utils')>()
      return {
        ...real,
        buildWorktreeEnv: vi.fn().mockReturnValue({ PATH: '/mocked' })
      }
    })
    const { buildWorktreeEnv } = await import('../../env-utils')
    // Re-import verify-worktree after mock is in place
    const { verifyWorktreeBuildsAndTests } = await import('../verify-worktree')
    const readFile = vi.fn().mockReturnValue(
      JSON.stringify({ scripts: { typecheck: 'tsc' } })
    )
    const runCommand = vi.fn().mockResolvedValue({ ok: true })
    await verifyWorktreeBuildsAndTests('/the/worktree', { logger: nullLogger() }, { runCommand, readFile })
    // The default runCommand is not used here since we injected one,
    // so assert via the module mock instead
    expect(buildWorktreeEnv).toHaveBeenCalledWith('/the/worktree')
  })
})
```

> Note: because `execFileRunCommand` is module-private, we assert via `vi.mock` on `buildWorktreeEnv`. The test confirms the wiring, not the internal function directly.

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- --run src/main/agent-manager/__tests__/verify-worktree.test.ts
```
Expected: FAIL — `buildWorktreeEnv` called 0 times (the default `runCommand` still calls `buildAgentEnv`)

- [ ] **Step 3: Update `execFileRunCommand`**

In `src/main/agent-manager/verify-worktree.ts`:

Change the import at line 24:
```typescript
import { buildAgentEnv } from '../env-utils'
```
to:
```typescript
import { buildWorktreeEnv } from '../env-utils'
```

Change line 196 inside `execFileRunCommand`:
```typescript
      env: buildAgentEnv(),
```
to:
```typescript
      env: buildWorktreeEnv(cwd),
```

- [ ] **Step 4: Run all verify-worktree tests**

```bash
npm test -- --run src/main/agent-manager/__tests__/verify-worktree.test.ts
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/main/agent-manager/verify-worktree.ts src/main/agent-manager/__tests__/verify-worktree.test.ts
git commit -m "fix(verify-worktree): use buildWorktreeEnv so node_modules/.bin is on PATH"
```

---

## Task 3: Thread `worktreePath` through the spawn stack

**Files:**
- Modify: `src/main/agent-manager/sdk-adapter.ts` (lines 107, 240, 272)
- Modify: `src/main/agent-manager/spawn-and-wire.ts` (line 124)
- Test: `src/main/agent-manager/__tests__/spawn-sdk.test.ts` (add assertion)

The goal: when `spawnWithTimeout` is called with a `worktreePath`, that path flows through `spawnAgent` → `spawnClaudeAgent` where `buildWorktreeEnv(worktreePath)` is used instead of `{ ...buildAgentEnv() }`.

- [ ] **Step 1: Add `worktreePath?` to `spawnClaudeAgent`**

In `sdk-adapter.ts`, find `async function spawnClaudeAgent(opts: {` (line ~240). Add `worktreePath?: string | undefined` to the opts type. Change line 251:

```typescript
// Before:
const env = { ...buildAgentEnv() }

// After:
const env = opts.worktreePath ? buildWorktreeEnv(opts.worktreePath) : { ...buildAgentEnv() }
```

Add the import alongside `buildAgentEnv`:
```typescript
import { buildAgentEnv, buildWorktreeEnv, getOAuthToken, getClaudeCliPath } from '../env-utils'
```

- [ ] **Step 2: Add `worktreePath?` to `spawnAgent` opts and thread it through**

In the `spawnAgent` opts interface (line ~107), add:
```typescript
worktreePath?: string | undefined
```

In the body where `spawnClaudeAgent` is called (line ~168):
```typescript
const claudeHandle = await spawnClaudeAgent({ ...opts, model: resolved.model })
```
The spread already passes `worktreePath` since it's now in `opts` — no change needed here.

- [ ] **Step 3: Add `worktreePath?` to `spawnWithTimeout` and thread it through**

In `spawnWithTimeout` (line ~272), add `worktreePath?: string` as a parameter after `tickId`:

```typescript
export async function spawnWithTimeout(
  prompt: string,
  cwd: string,
  model: string,
  logger: Logger,
  maxBudgetUsd?: number,
  pipelineTuning?: PipelineSpawnTuning,
  worktreeBase?: string,
  branch?: string,
  tickId?: string,
  epicGroupService?: EpicGroupService,
  worktreePath?: string   // ← add at end
): Promise<AgentHandle> {
```

In the `Promise.race` body (line ~292), add to the `spawnAgent` call:
```typescript
spawnAgent({ prompt, cwd, model, logger, maxBudgetUsd, pipelineTuning, worktreeBase, branch, tickId, epicGroupService, worktreePath }),
```

- [ ] **Step 4: Update `spawn-and-wire.ts` to pass `worktree.worktreePath`**

In `src/main/agent-manager/spawn-and-wire.ts`, find the `spawnWithTimeout` call (line ~124). The existing call passes **9 arguments** — it never passed `epicGroupService` (implicitly `undefined`). Now that `worktreePath` is added as the 11th parameter after `epicGroupService`, you must explicitly pass `undefined` for `epicGroupService` (arg 10) and `worktree.worktreePath` for `worktreePath` (arg 11):

```typescript
// Before (9 args):
handle = await spawnWithTimeout(
  prompt,
  worktree.worktreePath,
  effectiveModel,
  logger,
  task.max_cost_usd ?? undefined,
  pipelineTuning,
  deps.worktreeBase,
  worktree.branch,
  deps.tickId
)

// After (11 args — epicGroupService was always undefined here):
handle = await spawnWithTimeout(
  prompt,
  worktree.worktreePath,
  effectiveModel,
  logger,
  task.max_cost_usd ?? undefined,
  pipelineTuning,
  deps.worktreeBase,
  worktree.branch,
  deps.tickId,
  undefined,             // epicGroupService — pipeline agents don't use this
  worktree.worktreePath  // worktreePath — for buildWorktreeEnv
)
```

- [ ] **Step 5: Run typecheck and tests**

```bash
npm run typecheck && npm test -- --run src/main/agent-manager/__tests__/spawn-sdk.test.ts src/main/agent-manager/__tests__/spawn-and-wire.test.ts
```
Expected: zero type errors, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/main/agent-manager/sdk-adapter.ts src/main/agent-manager/spawn-and-wire.ts
git commit -m "feat(spawn): thread worktreePath through spawn stack to use buildWorktreeEnv"
```

---

## Task 4: `preflight-check.ts` — toolchain detection and binary probing

**Files:**
- Create: `src/main/agent-manager/preflight-check.ts`
- Create: `src/main/agent-manager/__tests__/preflight-check.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/main/agent-manager/__tests__/preflight-check.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'

// Mock execFileAsync at module level before importing the module under test
vi.mock('../../lib/async-utils', () => ({
  execFileAsync: vi.fn()
}))

import { detectToolchain, runPreflightChecks } from '../preflight-check'
import { execFileAsync } from '../../lib/async-utils'

function mockFs(present: string[]): void {
  vi.spyOn(fs, 'existsSync').mockImplementation((p) => present.includes(String(p)))
}

describe('detectToolchain', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns empty list for plain npm project', () => {
    mockFs(['/repo/package.json'])
    expect(detectToolchain('/repo')).toEqual([])
  })

  it('detects turbo from turbo.json', () => {
    mockFs(['/repo/turbo.json'])
    const signals = detectToolchain('/repo')
    expect(signals.map((s) => s.binary)).toContain('turbo')
  })

  it('detects turbo from package.json scripts referencing turbo', () => {
    mockFs([])
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ scripts: { typecheck: 'turbo run typecheck' } })
    )
    const signals = detectToolchain('/repo')
    expect(signals.map((s) => s.binary)).toContain('turbo')
  })

  it('detects pnpm from pnpm-workspace.yaml', () => {
    mockFs(['/repo/pnpm-workspace.yaml'])
    expect(detectToolchain('/repo').map((s) => s.binary)).toContain('pnpm')
  })

  it('detects pnpm from pnpm-lock.yaml', () => {
    mockFs(['/repo/pnpm-lock.yaml'])
    expect(detectToolchain('/repo').map((s) => s.binary)).toContain('pnpm')
  })

  it('detects java and gradlew from gradlew file', () => {
    mockFs(['/repo/gradlew'])
    const binaries = detectToolchain('/repo').map((s) => s.binary)
    expect(binaries).toContain('java')
    expect(binaries).toContain('gradlew')
  })

  it('detects mvn from pom.xml when no gradlew', () => {
    mockFs(['/repo/pom.xml'])
    expect(detectToolchain('/repo').map((s) => s.binary)).toContain('mvn')
  })

  it('detects python and poetry from pyproject.toml', () => {
    mockFs(['/repo/pyproject.toml'])
    const binaries = detectToolchain('/repo').map((s) => s.binary)
    expect(binaries).toContain('python')
    expect(binaries).toContain('poetry')
  })

  it('detects cargo from Cargo.toml', () => {
    mockFs(['/repo/Cargo.toml'])
    expect(detectToolchain('/repo').map((s) => s.binary)).toContain('cargo')
  })
})

describe('runPreflightChecks', () => {
  const env = { PATH: '/usr/bin' }
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(execFileAsync).mockResolvedValue({ stdout: '/usr/bin/turbo', stderr: '' })
  })

  it('returns ok:true when no toolchain signals detected', async () => {
    mockFs([]) // no signal files
    const result = await runPreflightChecks('/repo', env)
    expect(result).toEqual({ ok: true })
  })

  it('returns ok:true when all probed binaries are found', async () => {
    mockFs(['/repo/turbo.json', '/repo/node_modules/.bin/turbo'])
    const result = await runPreflightChecks('/repo', env)
    expect(result).toEqual({ ok: true })
  })

  it('returns ok:false with missing list when binary not found', async () => {
    mockFs(['/repo/turbo.json']) // turbo.json present but node_modules/.bin/turbo absent
    vi.mocked(execFileAsync).mockRejectedValue(new Error('not found'))
    const result = await runPreflightChecks('/repo', env)
    expect(result).toEqual({ ok: false, missing: ['turbo'] })
  })

  it('returns ok:true (fail-open) when detection itself throws', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(() => { throw new Error('EACCES') })
    const result = await runPreflightChecks('/repo', env)
    expect(result).toEqual({ ok: true })
  })

  it('uses existsSync for repo-local binaries (gradlew), not which', async () => {
    mockFs(['/repo/gradlew', '/repo/gradlew']) // gradlew present
    vi.mocked(execFileAsync).mockResolvedValue({ stdout: '/usr/bin/java', stderr: '' }) // java found
    const result = await runPreflightChecks('/repo', env)
    // gradlew is probed via existsSync, not execFileAsync('which', ...)
    expect(execFileAsync).not.toHaveBeenCalledWith('which', ['gradlew'], expect.anything())
    expect(result).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run to confirm all fail**

```bash
npm test -- --run src/main/agent-manager/__tests__/preflight-check.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement `preflight-check.ts`**

Create `src/main/agent-manager/preflight-check.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileAsync } from '../lib/async-utils'
import { createLogger } from '../logger'

const log = createLogger('preflight-check')

export interface ToolchainSignal {
  binary: string
  /** When true, probe via existsSync at localPath instead of `which`. */
  local?: boolean
  localPath?: string
}

/**
 * Inspects the repo root for known toolchain signals and returns the binaries
 * that need to be present for agents to function. Plain npm projects return
 * an empty list — node and npm are already guaranteed by buildAgentEnv.
 */
export function detectToolchain(repoPath: string): ToolchainSignal[] {
  try {
    return gatherSignals(repoPath)
  } catch (err) {
    log.warn(`[preflight-check] detectToolchain failed (fail-open): ${err}`)
    return []
  }
}

function gatherSignals(repoPath: string): ToolchainSignal[] {
  const signals: ToolchainSignal[] = []
  const has = (file: string): boolean => existsSync(join(repoPath, file))

  // Turbo: check turbo.json OR package.json scripts referencing turbo
  const hasTurboJson = has('turbo.json')
  const hasTurboScript = !hasTurboJson && packageScriptsReferenceTurbo(repoPath)
  if (hasTurboJson || hasTurboScript) {
    const localTurbo = join(repoPath, 'node_modules', '.bin', 'turbo')
    signals.push({ binary: 'turbo', local: true, localPath: localTurbo })
  }

  // pnpm
  if (has('pnpm-workspace.yaml') || has('pnpm-lock.yaml')) {
    signals.push({ binary: 'pnpm' })
  }

  // Yarn Berry
  if (has('.yarnrc.yml')) {
    signals.push({ binary: 'yarn' })
  }

  // Gradle
  if (has('gradlew')) {
    signals.push({ binary: 'java' })
    signals.push({ binary: 'gradlew', local: true, localPath: join(repoPath, 'gradlew') })
  } else if (has('pom.xml')) {
    // Maven (only when no Gradle wrapper)
    signals.push({ binary: 'mvn' })
  }

  // Python / Poetry
  if (has('pyproject.toml') || has('poetry.lock')) {
    signals.push({ binary: 'python' })
    signals.push({ binary: 'poetry' })
  }

  // Rust
  if (has('Cargo.toml')) {
    signals.push({ binary: 'cargo' })
  }

  return signals
}

function packageScriptsReferenceTurbo(repoPath: string): boolean {
  try {
    const raw = readFileSync(join(repoPath, 'package.json'), 'utf-8')
    const pkg = JSON.parse(raw) as Record<string, unknown>
    const scripts = pkg.scripts as Record<string, string> | undefined
    return !!scripts && Object.values(scripts).some((v) => v.includes('turbo'))
  } catch {
    return false
  }
}

export type PreflightResult = { ok: true } | { ok: false; missing: string[] }

/**
 * Runs toolchain detection and probes each required binary.
 * Returns ok:true if all pass, ok:false with the missing list otherwise.
 * Always returns ok:true on detection errors — a broken detector must not
 * block spawning.
 */
export async function runPreflightChecks(
  repoPath: string,
  env: Record<string, string | undefined>
): Promise<PreflightResult> {
  const signals = detectToolchain(repoPath)
  if (signals.length === 0) return { ok: true }

  const missing: string[] = []
  for (const signal of signals) {
    const found = await probeBinary(signal, env)
    if (!found) missing.push(signal.binary)
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}

async function probeBinary(
  signal: ToolchainSignal,
  env: Record<string, string | undefined>
): Promise<boolean> {
  if (signal.local && signal.localPath) {
    return existsSync(signal.localPath)
  }
  try {
    await execFileAsync('which', [signal.binary], { env, timeout: 5000 })
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --run src/main/agent-manager/__tests__/preflight-check.test.ts
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/main/agent-manager/preflight-check.ts src/main/agent-manager/__tests__/preflight-check.test.ts
git commit -m "feat(preflight): add toolchain detection and binary probe module"
```

---

## Task 5: `preflight-gate.ts` — IPC promise bridge

**Files:**
- Create: `src/main/agent-manager/preflight-gate.ts`
- Create: `src/main/agent-manager/__tests__/preflight-gate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/main/agent-manager/__tests__/preflight-gate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../broadcast', () => ({ broadcast: vi.fn() }))

import { createPreflightGate } from '../preflight-gate'
import { broadcast } from '../../broadcast'

describe('PreflightGate', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('resolves true when resolveConfirmation called with proceed=true', async () => {
    const gate = createPreflightGate()
    const promise = gate.requestConfirmation('task-1', ['turbo'], 'my-repo', 'My Task')
    gate.resolveConfirmation('task-1', true)
    expect(await promise).toBe(true)
  })

  it('resolves false when resolveConfirmation called with proceed=false', async () => {
    const gate = createPreflightGate()
    const promise = gate.requestConfirmation('task-1', ['turbo'], 'my-repo', 'My Task')
    gate.resolveConfirmation('task-1', false)
    expect(await promise).toBe(false)
  })

  it('broadcasts agent:preflightWarning on requestConfirmation', async () => {
    const gate = createPreflightGate()
    const promise = gate.requestConfirmation('task-1', ['turbo'], 'my-repo', 'My Task')
    gate.resolveConfirmation('task-1', true)
    await promise
    expect(broadcast).toHaveBeenCalledWith('agent:preflightWarning', {
      taskId: 'task-1',
      repoName: 'my-repo',
      taskTitle: 'My Task',
      missing: ['turbo']
    })
  })

  it('auto-resolves false after timeout', async () => {
    vi.useFakeTimers()
    const gate = createPreflightGate()
    const promise = gate.requestConfirmation('task-2', ['cargo'], 'a-repo', 'A Task')
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(await promise).toBe(false)
  })

  it('noops resolveConfirmation for unknown taskId', () => {
    const gate = createPreflightGate()
    expect(() => gate.resolveConfirmation('no-such-task', true)).not.toThrow()
  })

  it('second requestConfirmation for different task does not interfere', async () => {
    const gate = createPreflightGate()
    const p1 = gate.requestConfirmation('task-a', ['turbo'], 'repo', 'Task A')
    const p2 = gate.requestConfirmation('task-b', ['cargo'], 'repo', 'Task B')
    gate.resolveConfirmation('task-a', true)
    gate.resolveConfirmation('task-b', false)
    expect(await p1).toBe(true)
    expect(await p2).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm all fail**

```bash
npm test -- --run src/main/agent-manager/__tests__/preflight-gate.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement `preflight-gate.ts`**

Create `src/main/agent-manager/preflight-gate.ts`:

```typescript
import { broadcast } from '../broadcast'
import { createLogger } from '../logger'

const log = createLogger('preflight-gate')
const CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000

export interface PreflightGate {
  requestConfirmation(
    taskId: string,
    missing: string[],
    repoName: string,
    taskTitle: string
  ): Promise<boolean>
  resolveConfirmation(taskId: string, proceed: boolean): void
}

interface PendingEntry {
  resolve: (proceed: boolean) => void
  timer: ReturnType<typeof setTimeout>
}

export function createPreflightGate(): PreflightGate {
  const pending = new Map<string, PendingEntry>()

  return {
    requestConfirmation(taskId, missing, repoName, taskTitle) {
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          if (pending.has(taskId)) {
            pending.delete(taskId)
            log.warn(`[preflight-gate] confirmation timed out for task ${taskId} — moving to backlog`)
            resolve(false)
          }
        }, CONFIRMATION_TIMEOUT_MS)

        pending.set(taskId, { resolve, timer })
        broadcast('agent:preflightWarning', { taskId, repoName, taskTitle, missing })
      })
    },

    resolveConfirmation(taskId, proceed) {
      const entry = pending.get(taskId)
      if (!entry) return
      clearTimeout(entry.timer)
      pending.delete(taskId)
      entry.resolve(proceed)
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --run src/main/agent-manager/__tests__/preflight-gate.test.ts
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/main/agent-manager/preflight-gate.ts src/main/agent-manager/__tests__/preflight-gate.test.ts
git commit -m "feat(preflight): add PreflightGate IPC promise bridge"
```

---

## Task 6: IPC channels, preload wiring, and handler

**Files:**
- Modify: `src/shared/ipc-channels/broadcast-channels.ts`
- Modify: `src/shared/ipc-channels/agent-channels.ts`
- Modify: `src/preload/api-agents.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/main/handlers/agent-handlers.ts`
- Modify: `src/renderer/src/test-setup.ts`

- [ ] **Step 1: Add broadcast channel**

In `src/shared/ipc-channels/broadcast-channels.ts`, add to the `BroadcastChannels` interface after `'orphan:recovered'`:

```typescript
  // Pre-flight toolchain warnings (main → renderer)
  'agent:preflightWarning': {
    taskId: string
    repoName: string
    taskTitle: string
    missing: string[]
  }
```

- [ ] **Step 2: Add invoke channel**

In `src/shared/ipc-channels/agent-channels.ts`, add a new entry to the `IpcChannelMap` for the renderer→main response:

```typescript
  'agent:preflightResponse': {
    args: [{ taskId: string; proceed: boolean }]
    result: void
  }
```

- [ ] **Step 3: Wire the broadcast in the preload**

In `src/preload/api-agents.ts`, add to the `agentManager` object after `onOrphanRecovered`:

```typescript
  onPreflightWarning: onBroadcast<BroadcastChannels['agent:preflightWarning']>('agent:preflightWarning'),
```

Add `agent:preflightResponse` invoke to the `agents` object (or a new `preflight` namespace — keep it in `agentManager` for consistency since it's manager-level):

```typescript
  respondToPreflight: (taskId: string, proceed: boolean): Promise<void> =>
    typedInvoke('agent:preflightResponse', { taskId, proceed }),
```

- [ ] **Step 4: Update `index.d.ts` types**

In `src/preload/index.d.ts`, add to the `agentManager` block (after `onOrphanRecovered`):

```typescript
        onPreflightWarning: (
          cb: (payload: { taskId: string; repoName: string; taskTitle: string; missing: string[] }) => void
        ) => () => void
        respondToPreflight: (taskId: string, proceed: boolean) => Promise<void>
```

- [ ] **Step 5: Add `safeHandle` in `agent-handlers.ts`**

The actual signature of `registerAgentHandlers` is:
```typescript
export function registerAgentHandlers(am?: AgentManager, repo?: IDashboardRepository): void
```

Add `preflightGate` as an **optional third parameter** so existing call sites (`registry.ts` lines 78 and 82, tests) keep working without changes:

```typescript
import type { PreflightGate } from '../agent-manager/preflight-gate'

export function registerAgentHandlers(
  am?: AgentManager,
  repo?: IDashboardRepository,
  preflightGate?: PreflightGate   // ← add as optional third param
): void {
```

At the end of the function body, add (guarded):
```typescript
  if (preflightGate) {
    safeHandle('agent:preflightResponse', (_e, { taskId, proceed }: { taskId: string; proceed: boolean }) => {
      preflightGate.resolveConfirmation(taskId, proceed)
    })
  }
```

- [ ] **Step 6: Update `src/main/handlers/registry.ts` to create and pass the gate**

`registerAgentHandlers` is called from **`src/main/handlers/registry.ts`**, not `index.ts`. Find the two call sites:

```typescript
registerAgentHandlers(agentManager, repo)   // line 78
registerAgentHandlers(undefined, repo)       // line 82
```

Create the gate once near the top of the function and pass it to the first call:

```typescript
import { createPreflightGate } from '../agent-manager/preflight-gate'

// Near top of registerHandlers (or equivalent function):
const preflightGate = createPreflightGate()

// Pass to the call that has agentManager:
registerAgentHandlers(agentManager, repo, preflightGate)  // line 78
registerAgentHandlers(undefined, repo)                     // line 82 — no gate needed
```

The `preflightGate` instance created here will be passed to `AgentManagerImpl` in Task 7.

- [ ] **Step 7: Update `test-setup.ts`**

In `src/renderer/src/test-setup.ts`, add mocks for the new API methods in the `agentManager` mock object:

```typescript
onPreflightWarning: vi.fn().mockReturnValue(() => {}),
respondToPreflight: vi.fn().mockResolvedValue(undefined),
```

- [ ] **Step 8: Run typecheck**

```bash
npm run typecheck
```
Expected: zero type errors

- [ ] **Step 9: Commit**

```bash
git add src/shared/ipc-channels/broadcast-channels.ts \
  src/shared/ipc-channels/agent-channels.ts \
  src/preload/api-agents.ts \
  src/preload/index.d.ts \
  src/main/handlers/agent-handlers.ts \
  src/main/index.ts \
  src/renderer/src/test-setup.ts
git commit -m "feat(ipc): wire agent:preflightWarning broadcast and agent:preflightResponse handler"
```

---

## Task 7: Integrate pre-flight into `processQueuedTask`

**Files:**
- Modify: `src/main/agent-manager/task-claimer.ts`
- Modify: `src/main/agent-manager/index.ts`
- Test: `src/main/agent-manager/__tests__/task-claimer.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/main/agent-manager/__tests__/task-claimer.test.ts`, add to the `processQueuedTask` describe block:

```typescript
// Add these imports at the top of the file:
// import type { PreflightGate } from '../preflight-gate'
// vi.mock('../preflight-check', () => ({ runPreflightChecks: vi.fn() }))
// import { runPreflightChecks } from '../preflight-check'

describe('processQueuedTask — pre-flight', () => {
  function makeGate(proceed: boolean): PreflightGate {
    return {
      requestConfirmation: vi.fn().mockResolvedValue(proceed),
      resolveConfirmation: vi.fn()
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mapQueuedTask).mockReturnValue(makeTask())
    vi.mocked(checkAndBlockDeps).mockReturnValue(false)
    vi.mocked(getRepoPaths).mockReturnValue({ fleet: '/Users/ryan/projects/FLEET' })
    vi.mocked(setupWorktree).mockResolvedValue({ worktreePath: '/tmp/wt', branch: 'agent/task-1' })
    vi.mocked(runPreflightChecks).mockResolvedValue({ ok: true })
  })

  it('proceeds normally when pre-flight passes', async () => {
    vi.mocked(runPreflightChecks).mockResolvedValue({ ok: true })
    const deps = makeProcessDeps({ preflightGate: makeGate(true) })
    await processQueuedTask({ id: 'task-1', title: 'T' }, new Map(), deps)
    expect(deps.spawnAgent).toHaveBeenCalled()
  })

  it('moves task to backlog when pre-flight fails and user cancels', async () => {
    vi.mocked(runPreflightChecks).mockResolvedValue({ ok: false, missing: ['turbo'] })
    const gate = makeGate(false)
    const deps = makeProcessDeps({ preflightGate: gate })
    await processQueuedTask({ id: 'task-1', title: 'T' }, new Map(), deps)
    expect(deps.spawnAgent).not.toHaveBeenCalled()
    expect(deps.repo.updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ status: 'backlog' })
    )
  })

  it('spawns with warning note when pre-flight fails and user confirms', async () => {
    vi.mocked(runPreflightChecks).mockResolvedValue({ ok: false, missing: ['turbo'] })
    const gate = makeGate(true)
    const deps = makeProcessDeps({ preflightGate: gate })
    await processQueuedTask({ id: 'task-1', title: 'T' }, new Map(), deps)
    expect(deps.spawnAgent).toHaveBeenCalled()
  })

  it('skips pre-flight when preflightGate is null', async () => {
    vi.mocked(runPreflightChecks).mockResolvedValue({ ok: false, missing: ['turbo'] })
    const deps = makeProcessDeps({ preflightGate: null })
    await processQueuedTask({ id: 'task-1', title: 'T' }, new Map(), deps)
    // With null gate, pre-flight is skipped — agent still spawns
    expect(deps.spawnAgent).toHaveBeenCalled()
  })
})
```

Also add `runPreflightChecks` mock at the top of the file:
```typescript
vi.mock('../preflight-check', () => ({ runPreflightChecks: vi.fn() }))
import { runPreflightChecks } from '../preflight-check'
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
npm test -- --run src/main/agent-manager/__tests__/task-claimer.test.ts
```
Expected: new tests FAIL — `preflightGate` not in deps type

- [ ] **Step 3: Add `preflightGate` to `ProcessQueuedTaskDeps`**

In `src/main/agent-manager/task-claimer.ts`, add to the `ProcessQueuedTaskDeps` interface:

```typescript
import type { PreflightGate } from './preflight-gate'
import { runPreflightChecks } from './preflight-check'
import { buildAgentEnv } from '../env-utils'

// In ProcessQueuedTaskDeps:
  /**
   * Pre-flight gate for toolchain binary checks. Pass null to disable
   * pre-flight (useful in tests and non-pipeline spawn paths).
   */
  preflightGate: PreflightGate | null
```

- [ ] **Step 4: Add pre-flight logic to `processQueuedTask`**

In `processQueuedTask`, insert between `markProcessing` (line 258) and `validateAndClaimTask` (line 260):

```typescript
  deps.spawnRegistry.markProcessing(taskId)
  try {
    // Pre-flight: check required toolchain binaries before claiming the task.
    // Runs after markProcessing so subsequent drain ticks skip this task while
    // the user is responding to the modal.
    if (deps.preflightGate) {
      const repoPath = deps.resolveRepoPath(rawTask.repo ?? '')
      if (repoPath) {
        const preflightResult = await runPreflightChecks(repoPath, buildAgentEnv())
        if (!preflightResult.ok) {
          deps.spawnRegistry.unmarkProcessing(taskId)
          const proceed = await deps.preflightGate.requestConfirmation(
            taskId,
            preflightResult.missing,
            rawTask.repo ?? '',
            rawTask.title ?? taskId
          )
          if (!proceed) {
            await deps.repo.updateTask(taskId, {
              status: 'backlog',
              notes: `Moved to backlog: pre-flight detected missing binaries: ${preflightResult.missing.join(', ')}.`
            })
            return
          }
          // User confirmed — re-mark and continue with a warning note appended later
          deps.spawnRegistry.markProcessing(taskId)
        }
      }
    }

    const claimed = await validateAndClaimTask(rawTask, taskStatusMap, deps)
    ...
```

- [ ] **Step 5: Wire `preflightGate` into `AgentManagerImpl`**

In `src/main/agent-manager/index.ts`, add `preflightGate` as an **optional last parameter** to avoid breaking existing test construction:

```typescript
import type { PreflightGate } from './preflight-gate'

// Add private field:
private readonly _preflightGate: PreflightGate | null

// In the constructor signature (add at end, optional):
constructor(
  config: AgentManagerConfig,
  repo: ISprintTaskRepository,
  logger: Logger,
  preflightGate?: PreflightGate   // ← new optional last param
) {
  ...
  this._preflightGate = preflightGate ?? null
}
```

In `_processQueuedTask` (line ~490), add `preflightGate: this._preflightGate` to the deps object passed to `processQueuedTask`.

Update `createAgentManager` factory (same file) to accept and forward `preflightGate?` as a last optional param.

The `preflightGate` created in `registry.ts` (Task 6) must be passed when constructing the agent manager. Find where `createAgentManager` is called (in `src/main/handlers/registry.ts` or `src/main/index.ts` — confirm with grep) and add the gate as the final argument.

- [ ] **Step 6: Run all task-claimer tests**

```bash
npm test -- --run src/main/agent-manager/__tests__/task-claimer.test.ts
```
Expected: all tests pass including new pre-flight tests

- [ ] **Step 7: Run full typecheck**

```bash
npm run typecheck
```
Expected: zero errors

- [ ] **Step 8: Commit**

```bash
git add src/main/agent-manager/task-claimer.ts src/main/agent-manager/index.ts src/main/agent-manager/__tests__/task-claimer.test.ts
git commit -m "feat(drain): run pre-flight toolchain check in processQueuedTask before claiming"
```

---

## Task 8: `preflightStore` and `PreflightWarningModal`

**Files:**
- Create: `src/renderer/src/stores/preflightStore.ts`
- Create: `src/renderer/src/components/sprint/PreflightWarningModal.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Create `preflightStore.ts`**

Create `src/renderer/src/stores/preflightStore.ts`:

```typescript
import { create } from 'zustand'

interface PreflightWarning {
  taskId: string
  repoName: string
  taskTitle: string
  missing: string[]
}

interface PreflightStore {
  queue: PreflightWarning[]
  enqueue: (warning: PreflightWarning) => void
  dequeue: () => void
}

export const usePreflightStore = create<PreflightStore>((set) => ({
  queue: [],
  enqueue: (warning) => set((s) => ({ queue: [...s.queue, warning] })),
  dequeue: () => set((s) => ({ queue: s.queue.slice(1) }))
}))
```

- [ ] **Step 2: Create `PreflightWarningModal.tsx`**

Create `src/renderer/src/components/sprint/PreflightWarningModal.tsx`:

```typescript
import { useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { usePreflightStore } from '../../stores/preflightStore'

export function PreflightWarningModal(): JSX.Element | null {
  const { queue, enqueue, dequeue } = usePreflightStore()

  useEffect(() => {
    return window.api.agentManager.onPreflightWarning((payload) => {
      enqueue(payload)
    })
  }, [enqueue])

  const current = queue[0]
  if (!current) return null

  async function handleRespond(proceed: boolean): Promise<void> {
    await window.api.agentManager.respondToPreflight(current.taskId, proceed)
    dequeue()
  }

  return (
    <Modal size="md" onClose={() => handleRespond(false)}>
      <div className="preflight-warning">
        <h2>Missing toolchain binaries</h2>
        <p>
          <strong>{current.repoName}</strong> — {current.taskTitle}
        </p>
        <p>The following binaries were not found on PATH or in node_modules/.bin:</p>
        <ul>
          {current.missing.map((b) => (
            <li key={b}>
              <code>{b}</code>
            </li>
          ))}
        </ul>
        <p>The agent will likely fail at its first shell command without these tools installed.</p>
        <div className="preflight-warning__actions">
          <button
            className="btn btn--default"
            onClick={() => handleRespond(false)}
          >
            Move to backlog
          </button>
          <button
            className="btn btn--warning"
            onClick={() => handleRespond(true)}
          >
            Proceed anyway
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 3: Mount in `App.tsx`**

In `src/renderer/src/App.tsx`, add the import and mount:

```typescript
import { PreflightWarningModal } from './components/sprint/PreflightWarningModal'
```

In the JSX, alongside `<TaskWorkbenchModal />`:
```tsx
<PreflightWarningModal />
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```
Expected: zero errors

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/stores/preflightStore.ts \
  src/renderer/src/components/sprint/PreflightWarningModal.tsx \
  src/renderer/src/App.tsx
git commit -m "feat(ui): add PreflightWarningModal and preflightStore"
```

---

## Task 9: Module documentation

**Files:**
- Modify: `docs/modules/agent-manager/index.md`
- Modify: `docs/modules/stores/index.md`
- Modify: `docs/modules/components/index.md`
- Modify: `docs/modules/lib/main/index.md` (env-utils is in main lib)

- [ ] **Step 1: Update agent-manager index**

Add rows for `preflight-check.ts` and `preflight-gate.ts` to `docs/modules/agent-manager/index.md`.

- [ ] **Step 2: Update stores index**

Add row for `preflightStore.ts` to `docs/modules/stores/index.md`.

- [ ] **Step 3: Update components index**

Add row for `PreflightWarningModal.tsx` (group: `sprint`) to `docs/modules/components/index.md`.

- [ ] **Step 4: Update env-utils docs**

Update the `env-utils` entry in the appropriate module index to mention `buildWorktreeEnv`.

- [ ] **Step 5: Commit**

```bash
git add docs/modules/
git commit -m "chore(docs): update module docs for toolchain awareness changes"
```

---

## Task 10: Final validation

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: all 323+ test files pass

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```
Expected: zero errors

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: zero errors (warnings OK)

- [ ] **Step 4: Push**

```bash
git push origin main
```
The pre-push hook runs the full suite. Confirm it passes.
