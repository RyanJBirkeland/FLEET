# Verification Output Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture FLEET's verification gate output (typecheck + tests) on every pipeline agent completion and display it alongside expanded agent test-run detection in a renamed "Verification" tab in Code Review Station.

**Architecture:** New nullable JSON column `verification_results` on `sprint_tasks` stores structured, capped output from both verification commands. `verify-worktree.ts` is extended to return raw stdout/stderr on success (currently discards it). `verification-gate.ts` caps and persists results before the existing failure/requeue logic. The renderer reads the field from the task object already in the store — no new IPC channel needed. The Tests tab is renamed Verification and restructured into two sections: FLEET Verified (gate results) and Agent Test Runs (expanded pattern-matched Bash events).

**Tech Stack:** TypeScript, better-sqlite3, React, Zustand, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/shared/types/task-types.ts` | Add `VerificationRecord`, `VerificationResults`, `isVerificationResults`, extend `SprintTask` |
| Modify | `src/main/agent-manager/prompt-constants.ts` | Add `VERIFICATION_OUTPUT_CAP = 10_000` |
| Create | `src/main/migrations/v059-add-verification-results-to-sprint-tasks.ts` | `ALTER TABLE` migration |
| Create | `src/main/migrations/__tests__/v059.test.ts` | Migration correctness test |
| Modify | `src/main/agent-manager/verify-worktree.ts` | Extend `CommandResult` to carry stdout/stderr/durationMs on success; return `WorktreeVerificationOutput` |
| Modify | `src/main/agent-manager/verification-gate.ts` | Add `capOutput`, `toVerificationRecord`; persist results before failure/success branching |
| Modify | `src/main/data/sprint-task-mapper.ts` | Parse + validate `verification_results` JSON column |
| Modify | `src/renderer/src/lib/extract-test-runs.ts` | Expand test runner pattern (gradle, maven) |
| Create | `src/renderer/src/components/code-review/VerificationTab.tsx` | Two-section tab: FLEET gate results + agent test runs |
| Create | `src/renderer/src/components/code-review/__tests__/VerificationTab.test.tsx` | Component tests |
| Modify | `src/renderer/src/stores/codeReview.ts` | Rename `DiffMode` `'tests'` → `'verification'`; hydration guard |
| Modify | `src/renderer/src/components/code-review/DiffViewerPanel.tsx` | Rename tab label; swap `<TestsTab>` → `<VerificationTab>` |
| Delete | `src/renderer/src/components/code-review/TestsTab.tsx` | Replaced by VerificationTab |

---

## Task 1: Types and output-cap constant

**Files:**
- Modify: `src/shared/types/task-types.ts`
- Modify: `src/main/agent-manager/prompt-constants.ts`

- [ ] **Step 1: Add `VERIFICATION_OUTPUT_CAP` to prompt-constants.ts**

Add after the closing `} as const` of `PROMPT_TRUNCATION`:

```typescript
/**
 * Maximum characters stored per field in a VerificationRecord.
 * A large test suite can emit 50KB+ of output; this cap keeps the SQLite
 * row sane while preserving enough context for the reviewer.
 */
export const VERIFICATION_OUTPUT_CAP = 10_000
```

- [ ] **Step 2: Add types to task-types.ts**

Find the `RevisionFeedbackEntry` interface (near the top of the file) and add these types immediately after it:

```typescript
export interface VerificationRecord {
  exitCode: number
  stdout: string
  stderr: string
  /** true when stdout or stderr was truncated to VERIFICATION_OUTPUT_CAP chars */
  truncated: boolean
  durationMs: number
  timestamp: string // ISO-8601
}

export interface VerificationResults {
  /** null when the repo has no typecheck script */
  typecheck: VerificationRecord | null
  /** null when typecheck failed (gate short-circuits) or repo has no test script */
  tests: VerificationRecord | null
}

export function isVerificationResults(v: unknown): v is VerificationResults {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return 'typecheck' in r && 'tests' in r
}
```

- [ ] **Step 3: Add `verification_results` field to SprintTask**

In the `SprintTask` interface, add after `last_rendered_prompt`:

```typescript
verification_results?: VerificationResults | null
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/task-types.ts src/main/agent-manager/prompt-constants.ts
git commit -m "feat(types): add VerificationRecord, VerificationResults, VERIFICATION_OUTPUT_CAP"
```

---

## Task 2: Migration v059

**Files:**
- Create: `src/main/migrations/v059-add-verification-results-to-sprint-tasks.ts`
- Create: `src/main/migrations/__tests__/v059.test.ts`

> Note: `loader.ts` auto-discovers migrations via `import.meta.glob('./v*.ts')` — no manual registration needed.

- [ ] **Step 1: Write the failing migration test**

Create `src/main/migrations/__tests__/v059.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { up, version } from '../v059-add-verification-results-to-sprint-tasks'

describe('migration v059', () => {
  it('has version 59', () => {
    expect(version).toBe(59)
  })

  it('adds verification_results column to sprint_tasks', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE sprint_tasks (id TEXT PRIMARY KEY, title TEXT)`)

    up(db)

    const col = db
      .prepare(
        `SELECT name FROM pragma_table_info('sprint_tasks') WHERE name = 'verification_results'`
      )
      .get() as { name: string } | undefined

    expect(col?.name).toBe('verification_results')
    db.close()
  })

  it('existing rows keep null in the new column', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE sprint_tasks (id TEXT PRIMARY KEY, title TEXT)`)
    db.exec(`INSERT INTO sprint_tasks VALUES ('t1', 'Task 1')`)

    up(db)

    const row = db.prepare(`SELECT verification_results FROM sprint_tasks WHERE id = 't1'`).get() as {
      verification_results: string | null
    }
    expect(row.verification_results).toBeNull()
    db.close()
  })

  it('column accepts valid JSON', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE sprint_tasks (id TEXT PRIMARY KEY, title TEXT)`)
    up(db)

    const json = JSON.stringify({ typecheck: null, tests: null })
    db.exec(`INSERT INTO sprint_tasks VALUES ('t2', 'Task 2')`)
    db.prepare(`UPDATE sprint_tasks SET verification_results = ? WHERE id = 't2'`).run(json)

    const row = db.prepare(`SELECT verification_results FROM sprint_tasks WHERE id = 't2'`).get() as {
      verification_results: string
    }
    expect(JSON.parse(row.verification_results)).toEqual({ typecheck: null, tests: null })
    db.close()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:main -- v059
```

Expected: fails with "Cannot find module '../v059-add-verification-results-to-sprint-tasks'"

- [ ] **Step 3: Create the migration file**

Create `src/main/migrations/v059-add-verification-results-to-sprint-tasks.ts`:

```typescript
import type Database from 'better-sqlite3'

export const version = 59
export const description = 'Add verification_results column to sprint_tasks for gate output capture'

export const up = (db: Database.Database): void => {
  const sql = `ALTER TABLE sprint_tasks ADD COLUMN verification_results TEXT`
  db.exec(sql)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:main -- v059
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/migrations/v059-add-verification-results-to-sprint-tasks.ts \
        src/main/migrations/__tests__/v059.test.ts
git commit -m "feat(migrations): v059 add verification_results column to sprint_tasks"
```

---

## Task 3: extend verify-worktree.ts to return raw output

**Files:**
- Modify: `src/main/agent-manager/verify-worktree.ts`

> Currently `CommandResult = { ok: true } | { ok: false; output: string }` and `execFileRunCommand` discards stdout/stderr on success. We extend it to always carry output.

- [ ] **Step 1: Add `WorktreeVerificationOutput` export and update `CommandResult`**

At the top of the file, find and replace the `CommandResult` type (line ~52):

```typescript
// Before:
export type CommandResult = { ok: true } | { ok: false; output: string }

// After:
export type CommandResult =
  | { ok: true; stdout: string; stderr: string; durationMs: number }
  | { ok: false; stdout: string; stderr: string; durationMs: number }
```

Add after `CommandResult`:

```typescript
/** Full output of both verification steps. null = step was not run. */
export interface WorktreeVerificationOutput {
  typecheck: CommandResult | null
  tests: CommandResult | null
}
```

- [ ] **Step 2: Update `execFileRunCommand` to capture output and timing on success**

Replace the `execFileRunCommand` function (near the bottom of the file):

```typescript
async function execFileRunCommand(
  command: string,
  args: readonly string[],
  cwd: string,
  timeoutMs: number
): Promise<CommandResult> {
  const startMs = Date.now()
  try {
    const result = await execFileAsync(command, [...args], {
      cwd,
      env: buildWorktreeEnv(cwd),
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024
    })
    return {
      ok: true,
      stdout: typeof result.stdout === 'string' ? result.stdout : '',
      stderr: typeof result.stderr === 'string' ? result.stderr : '',
      durationMs: Date.now() - startMs
    }
  } catch (err) {
    const { stdout, stderr } = extractCommandOutputParts(err)
    return { ok: false, stdout, stderr, durationMs: Date.now() - startMs }
  }
}
```

- [ ] **Step 3: Add `extractCommandOutputParts` and update `extractCommandOutput`**

Replace the existing `extractCommandOutput` function with these two:

```typescript
function extractCommandOutputParts(err: unknown): { stdout: string; stderr: string } {
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    return {
      stdout: typeof record.stdout === 'string' ? record.stdout : '',
      stderr: typeof record.stderr === 'string' ? record.stderr : ''
    }
  }
  const msg = err instanceof Error ? err.message : String(err)
  return { stdout: '', stderr: msg }
}

/** Combined stderr+stdout string for use in failure notes. */
function extractCommandOutput(err: unknown): string {
  const { stdout, stderr } = extractCommandOutputParts(err)
  return [stderr, stdout].filter((s) => s.length > 0).join('\n')
}
```

- [ ] **Step 4: Update `runVerificationAttempt` to return `CommandResult`**

`runVerificationAttempt` currently returns `Promise<VerificationResult>`. Change it to return `Promise<CommandResult>` and simplify — failure formatting now happens in the gate:

```typescript
async function runVerificationAttempt(
  attempt: CommandAttempt,
  worktreePath: string,
  logger: Logger,
  deps: VerificationDeps
): Promise<CommandResult> {
  const label = `${attempt.command} ${attempt.args.join(' ')}`
  const result = await deps.runCommand(attempt.command, attempt.args, worktreePath, attempt.timeoutMs)
  if (result.ok) {
    logger.info(`[verify-worktree] ${label} passed at ${worktreePath}`)
  } else {
    logger.warn(`[verify-worktree] ${label} failed at ${worktreePath}`)
  }
  return result
}
```

- [ ] **Step 5: Update `verifyWorktreeBuildsAndTests` to return `WorktreeVerificationOutput`**

Replace the function signature and body:

```typescript
export async function verifyWorktreeBuildsAndTests(
  worktreePath: string,
  logger: Logger,
  deps: VerificationDeps = defaultDeps()
): Promise<WorktreeVerificationOutput> {
  const readFile = deps.readFile ?? defaultReadFile
  const scripts = detectProjectScripts(worktreePath, readFile)

  let typecheckResult: CommandResult | null = null

  if (!scripts.hasTypecheck) {
    logger.info(`[verify-worktree] no typecheck script at ${worktreePath} — skipping typecheck`)
  } else {
    const typecheckAttempt: CommandAttempt = {
      command: 'npm',
      args: ['run', 'typecheck'],
      timeoutMs: TYPECHECK_TIMEOUT_MS,
      failureKind: 'compilation',
      keywordHint: 'typescript error'
    }
    typecheckResult = await runVerificationAttempt(typecheckAttempt, worktreePath, logger, deps)
    if (!typecheckResult.ok) {
      return { typecheck: typecheckResult, tests: null }
    }
  }

  if (scripts.testRunner === 'none') {
    logger.info(`[verify-worktree] no test script at ${worktreePath} — skipping test step`)
    return { typecheck: typecheckResult, tests: null }
  }

  const testAttempt: CommandAttempt = {
    command: 'npm',
    args: scripts.testRunner === 'vitest' ? ['test', '--', '--run'] : ['test'],
    timeoutMs: TEST_TIMEOUT_MS,
    failureKind: 'test_failure',
    keywordHint: 'test run failed'
  }
  const testsResult = await runVerificationAttempt(testAttempt, worktreePath, logger, deps)
  return { typecheck: typecheckResult, tests: testsResult }
}
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Fix any type errors before continuing. The main callers to check: `verification-gate.ts` (which imports `verifyWorktreeBuildsAndTests`) will now have type errors — that is expected and will be fixed in Task 4.

- [ ] **Step 7: Run verify-worktree tests**

```bash
npm run test:main -- verify-worktree
```

Expected: all existing tests pass. If any test mocks `runCommand` returning `{ ok: true }`, update the mock to `{ ok: true, stdout: '', stderr: '', durationMs: 0 }`.

- [ ] **Step 8: Commit**

```bash
git add src/main/agent-manager/verify-worktree.ts
git commit -m "feat(verify-worktree): capture stdout/stderr on success; return WorktreeVerificationOutput"
```

---

## Task 4: verification-gate.ts — cap, convert, and persist

**Files:**
- Modify: `src/main/agent-manager/verification-gate.ts`

- [ ] **Step 1: Add imports**

At the top of `verification-gate.ts`, add or update the import from `verify-worktree`:

```typescript
import {
  verifyWorktreeBuildsAndTests,
  type CommandResult,
  type WorktreeVerificationOutput
} from './verify-worktree'
```

Add import for the new types and constant:

```typescript
import { VERIFICATION_OUTPUT_CAP } from './prompt-constants'
import type { VerificationRecord, VerificationResults } from '../../shared/types/task-types'
```

- [ ] **Step 2: Add `capOutput` and `toVerificationRecord` pure helpers**

Add these after the imports, before `appendAdvisoryNote`:

```typescript
/** Exported for unit testing. */
export function capOutput(text: string, cap: number): { text: string; truncated: boolean } {
  if (text.length <= cap) return { text, truncated: false }
  return { text: text.slice(0, cap), truncated: true }
}

/** Exported for unit testing. */
export function toVerificationRecord(result: CommandResult): VerificationRecord {
  const cappedStdout = capOutput(result.stdout, VERIFICATION_OUTPUT_CAP)
  const cappedStderr = capOutput(result.stderr, VERIFICATION_OUTPUT_CAP)
  return {
    exitCode: result.ok ? 0 : 1,
    stdout: cappedStdout.text,
    stderr: cappedStderr.text,
    truncated: cappedStdout.truncated || cappedStderr.truncated,
    durationMs: result.durationMs,
    timestamp: new Date().toISOString()
  }
}

function buildVerificationResults(output: WorktreeVerificationOutput): VerificationResults {
  return {
    typecheck: output.typecheck ? toVerificationRecord(output.typecheck) : null,
    tests: output.tests ? toVerificationRecord(output.tests) : null
  }
}
```

- [ ] **Step 3: Write failing tests for the new helpers**

Create or open `src/main/agent-manager/__tests__/verification-gate.test.ts` (or find the existing test file) and add:

```typescript
import { describe, it, expect } from 'vitest'
import { capOutput, toVerificationRecord } from '../verification-gate'

describe('capOutput', () => {
  it('returns text unchanged when under the cap', () => {
    const result = capOutput('hello', 100)
    expect(result).toEqual({ text: 'hello', truncated: false })
  })

  it('truncates to exactly cap chars and sets truncated true', () => {
    const result = capOutput('abcde', 3)
    expect(result.text).toBe('abc')
    expect(result.truncated).toBe(true)
  })

  it('handles empty string', () => {
    expect(capOutput('', 100)).toEqual({ text: '', truncated: false })
  })
})

describe('toVerificationRecord', () => {
  it('sets exitCode 0 on ok result', () => {
    const rec = toVerificationRecord({ ok: true, stdout: 'out', stderr: '', durationMs: 100 })
    expect(rec.exitCode).toBe(0)
    expect(rec.stdout).toBe('out')
    expect(rec.truncated).toBe(false)
  })

  it('sets exitCode 1 on failed result', () => {
    const rec = toVerificationRecord({ ok: false, stdout: '', stderr: 'err', durationMs: 50 })
    expect(rec.exitCode).toBe(1)
    expect(rec.stderr).toBe('err')
  })

  it('sets truncated true when stdout exceeds cap', () => {
    const longStdout = 'x'.repeat(10_001)
    const rec = toVerificationRecord({ ok: true, stdout: longStdout, stderr: '', durationMs: 0 })
    expect(rec.truncated).toBe(true)
    expect(rec.stdout.length).toBe(10_000)
  })
})
```

- [ ] **Step 4: Run the new tests to confirm they pass**

```bash
npm run test:main -- verification-gate
```

Expected: new tests pass.

- [ ] **Step 5: Update `verifyWorktreeOrFail` to persist results and use new API**

Replace the `verifyWorktreeOrFail` function body. The function now:
1. Receives `WorktreeVerificationOutput` from the gate
2. Persists `verification_results` regardless of success/failure
3. Uses the new output shape to determine failure kind and build feedback notes

```typescript
export async function verifyWorktreeOrFail(opts: {
  taskId: string
  worktreePath: string
  retryCount: number
  repo: IAgentTaskRepository
  logger: Logger
  onTaskTerminal: (taskId: string, status: TaskStatus) => Promise<void>
  taskStateService: TaskStateService
}): Promise<boolean> {
  const { taskId, worktreePath, retryCount, repo, logger, onTaskTerminal, taskStateService } = opts

  const output = await verifyWorktreeBuildsAndTests(worktreePath, logger)

  // Persist gate results for the reviewer regardless of outcome.
  void repo.updateTask(taskId, {
    verification_results: buildVerificationResults(output)
  }).catch((err: unknown) => {
    logger.warn(`[completion] task ${taskId}: failed to persist verification_results — ${err}`)
  })

  const failed =
    (output.typecheck !== null && !output.typecheck.ok) ||
    (output.tests !== null && !output.tests.ok)

  if (!failed) return true

  const failedResult = (output.typecheck && !output.typecheck.ok)
    ? output.typecheck
    : output.tests!
  const failureKind: VerificationFailureKind =
    output.typecheck && !output.typecheck.ok ? 'compilation' : 'test_failure'

  logger.warn(
    `[completion] task ${taskId}: pre-review verification failed (${failureKind}) — requeueing`
  )

  const combinedOutput = [failedResult.stderr, failedResult.stdout]
    .filter((s) => s.length > 0)
    .join('\n')
  const feedback = buildVerificationRevisionFeedback(failureKind, combinedOutput)
  const notes = JSON.stringify(feedback)

  const failureOpts: ResolveFailureContext = { taskId, retryCount, notes, repo, taskStateService }
  const failureResult = await resolveFailurePhase(failureOpts, logger)
  if (failureResult.writeFailed) {
    logger.warn(
      `[completion] task ${taskId}: verification failure DB write failed — skipping terminal notification`
    )
    return false
  }
  const decision = failureResult.isTerminal ? 'terminal' : 'requeue'
  logger.event('completion.decision', { taskId, decision, reason: failureKind })
  await onTaskTerminal(taskId, failureResult.isTerminal ? 'failed' : 'queued')
  return false
}
```

Add the `VerificationFailureKind` import if not already present:

```typescript
import type { VerificationFailureKind } from './verify-worktree'
```

- [ ] **Step 6: Run typecheck and tests**

```bash
npm run typecheck && npm run test:main -- verification-gate
```

Expected: zero type errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/main/agent-manager/verification-gate.ts
git commit -m "feat(verification-gate): persist verification_results to task on every gate run"
```

---

## Task 5: parse verification_results in sprint-task-mapper.ts

**Files:**
- Modify: `src/main/data/sprint-task-mapper.ts`

- [ ] **Step 1: Add import**

At the top of `sprint-task-mapper.ts`, add to the shared types import:

```typescript
import { sanitizeDependsOn } from '../../shared/sanitize-depends-on'
import { isVerificationResults } from '../../shared/types/task-types'
// (add isVerificationResults alongside existing imports)
```

- [ ] **Step 2: Add `parseVerificationResults` function**

Add after `parseRevisionFeedback`:

```typescript
function parseVerificationResults(
  value: unknown
): import('../../shared/types/task-types').VerificationResults | null {
  let parsed: unknown = value
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }
  if (!isVerificationResults(parsed)) return null
  return parsed
}
```

- [ ] **Step 3: Add `verification_results` to `mapRowToTask`**

In `mapRowToTask`, add after the `revision_feedback` line:

```typescript
revision_feedback: parseRevisionFeedback(row.revision_feedback),
verification_results: parseVerificationResults(row.verification_results),
```

- [ ] **Step 4: Write mapper tests**

In the existing sprint-task-mapper test file, add:

```typescript
describe('parseVerificationResults (via mapRowToTask)', () => {
  const baseRow = {
    id: 'task-1', title: 'T', repo: 'fleet', status: 'queued', priority: 1
  }

  it('parses valid JSON into VerificationResults', () => {
    const results = { typecheck: null, tests: null }
    const row = { ...baseRow, verification_results: JSON.stringify(results) }
    const task = mapRowToTask(row as Record<string, unknown>)
    expect(task.verification_results).toEqual(results)
  })

  it('returns null for malformed JSON', () => {
    const row = { ...baseRow, verification_results: 'not-json' }
    const task = mapRowToTask(row as Record<string, unknown>)
    expect(task.verification_results).toBeNull()
  })

  it('returns null when column is absent', () => {
    const task = mapRowToTask(baseRow as Record<string, unknown>)
    expect(task.verification_results).toBeUndefined()
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm run test:main -- sprint-task-mapper
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/data/sprint-task-mapper.ts
git commit -m "feat(mapper): parse verification_results JSON column in mapRowToTask"
```

---

## Task 6: expand test runner patterns in extract-test-runs.ts

**Files:**
- Modify: `src/renderer/src/lib/extract-test-runs.ts`

- [ ] **Step 1: Write failing tests for new patterns**

In the existing `extract-test-runs` test file, add:

```typescript
describe('expanded test runner patterns', () => {
  function makeEvents(command: string, output: string): AgentEvent[] {
    return [
      {
        type: 'agent:tool_call',
        tool: 'Bash',
        input: { command },
        timestamp: new Date().toISOString()
      } as AgentEvent,
      {
        type: 'agent:tool_result',
        tool: 'Bash',
        output,
        timestamp: new Date().toISOString()
      } as AgentEvent
    ]
  }

  it('matches ./gradlew test', () => {
    const runs = extractTestRuns(makeEvents('./gradlew test', 'BUILD SUCCESS'))
    expect(runs).toHaveLength(1)
    expect(runs[0].command).toBe('./gradlew test')
  })

  it('matches ./gradlew prettierCheck', () => {
    const runs = extractTestRuns(makeEvents('./gradlew prettierCheck', 'BUILD SUCCESS'))
    expect(runs).toHaveLength(1)
  })

  it('matches mvn test', () => {
    const runs = extractTestRuns(makeEvents('mvn test', '[INFO] BUILD SUCCESS'))
    expect(runs).toHaveLength(1)
  })

  it('matches mvn verify', () => {
    const runs = extractTestRuns(makeEvents('mvn verify', '[INFO] BUILD SUCCESS'))
    expect(runs).toHaveLength(1)
  })

  it('matches ./mvnw test', () => {
    const runs = extractTestRuns(makeEvents('./mvnw test', '[INFO] BUILD SUCCESS'))
    expect(runs).toHaveLength(1)
  })

  it('does not match unrelated gradle tasks', () => {
    const runs = extractTestRuns(makeEvents('./gradlew build', 'BUILD SUCCESS'))
    expect(runs).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npm test -- extract-test-runs
```

Expected: the new "expanded" tests fail, existing tests pass.

- [ ] **Step 3: Update TEST_COMMAND_PATTERN**

In `src/renderer/src/lib/extract-test-runs.ts`, find `TEST_COMMAND_PATTERN` and replace:

```typescript
const TEST_COMMAND_PATTERN =
  /\b(npm (run )?test|yarn test|pnpm (run )?test|npx\s+vitest|vitest|jest|pytest|cargo test|go test|\.\/gradlew\s+\w*[Tt]est\w*|\.\/gradlew\s+\w*[Cc]heck\w*|gradle\s+test|mvn\s+(test|verify)|mvnw\s+(test|verify)|\.\/mvnw\s+(test|verify))\b/i
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npm test -- extract-test-runs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/extract-test-runs.ts
git commit -m "feat(extract-test-runs): add gradle, maven, and mvnw test runner patterns"
```

---

## Task 7: VerificationTab component

**Files:**
- Create: `src/renderer/src/components/code-review/VerificationTab.tsx`
- Create: `src/renderer/src/components/code-review/__tests__/VerificationTab.test.tsx`

The tab has two named sections:
- **FLEET Verified** — reads `task.verification_results` from the sprint tasks store. Two collapsible rows (typecheck + tests), each with pass/fail status, duration, and stdout/stderr pre block.
- **Agent Test Runs** — identical to the current TestsTab content (command, pass/fail badge, output). Source: agent events store via `extractTestRuns`.

- [ ] **Step 1: Write component tests first**

Create `src/renderer/src/components/code-review/__tests__/VerificationTab.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VerificationTab } from '../VerificationTab'

// Mock stores
vi.mock('../../../stores/sprintTasks', () => ({
  useSprintTasks: vi.fn()
}))
vi.mock('../../../stores/codeReview', () => ({
  useCodeReviewStore: vi.fn()
}))
vi.mock('../../../stores/agentEvents', () => ({
  useAgentEventsStore: vi.fn()
}))

import { useSprintTasks } from '../../../stores/sprintTasks'
import { useCodeReviewStore } from '../../../stores/codeReview'
import { useAgentEventsStore } from '../../../stores/agentEvents'

const mockUseSprintTasks = vi.mocked(useSprintTasks)
const mockUseCodeReview = vi.mocked(useCodeReviewStore)
const mockUseAgentEvents = vi.mocked(useAgentEventsStore)

function setupMocks(taskOverrides = {}) {
  mockUseCodeReview.mockReturnValue({ selectedTaskId: 'task-1' } as ReturnType<typeof useCodeReviewStore>)
  mockUseSprintTasks.mockReturnValue({
    tasks: [{ id: 'task-1', agent_run_id: 'run-1', ...taskOverrides }]
  } as ReturnType<typeof useSprintTasks>)
  mockUseAgentEvents.mockReturnValue({
    events: {},
    loadHistory: vi.fn()
  } as unknown as ReturnType<typeof useAgentEventsStore>)
}

describe('VerificationTab — FLEET Verified section', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows empty state when verification_results is null', () => {
    setupMocks({ verification_results: null })
    render(<VerificationTab />)
    expect(screen.getByText(/no fleet verification record/i)).toBeInTheDocument()
  })

  it('shows typecheck passed row', () => {
    setupMocks({
      verification_results: {
        typecheck: { exitCode: 0, stdout: 'tsc ok', stderr: '', truncated: false, durationMs: 4200, timestamp: '2026-05-04T00:00:00Z' },
        tests: null
      }
    })
    render(<VerificationTab />)
    expect(screen.getByText('Type check')).toBeInTheDocument()
    expect(screen.getByText(/passed/i)).toBeInTheDocument()
  })

  it('shows tests failed row', () => {
    setupMocks({
      verification_results: {
        typecheck: { exitCode: 0, stdout: '', stderr: '', truncated: false, durationMs: 1000, timestamp: '2026-05-04T00:00:00Z' },
        tests: { exitCode: 1, stdout: '', stderr: '3 tests failed', truncated: false, durationMs: 18000, timestamp: '2026-05-04T00:00:01Z' }
      }
    })
    render(<VerificationTab />)
    expect(screen.getByText('Tests')).toBeInTheDocument()
    expect(screen.getByText(/failed/i)).toBeInTheDocument()
    expect(screen.getByText('3 tests failed')).toBeInTheDocument()
  })

  it('shows truncation notice when truncated is true', () => {
    setupMocks({
      verification_results: {
        typecheck: { exitCode: 0, stdout: 'x'.repeat(10000), stderr: '', truncated: true, durationMs: 100, timestamp: '2026-05-04T00:00:00Z' },
        tests: null
      }
    })
    render(<VerificationTab />)
    expect(screen.getByText(/output truncated/i)).toBeInTheDocument()
  })
})

describe('VerificationTab — Agent Test Runs section', () => {
  it('renders the section heading', () => {
    setupMocks({ verification_results: null })
    render(<VerificationTab />)
    expect(screen.getByText('Agent Test Runs')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- VerificationTab
```

Expected: fails — module not found.

- [ ] **Step 3: Create the VerificationTab component**

Create `src/renderer/src/components/code-review/VerificationTab.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react'
import { useCodeReviewStore } from '../../stores/codeReview'
import { useSprintTasks } from '../../stores/sprintTasks'
import { useAgentEventsStore } from '../../stores/agentEvents'
import { extractTestRuns } from '../../lib/extract-test-runs'
import type { VerificationRecord } from '../../../../shared/types/task-types'

export function VerificationTab(): React.JSX.Element {
  const selectedTaskId = useCodeReviewStore((s) => s.selectedTaskId)
  const tasks = useSprintTasks((s) => s.tasks)
  const loadHistory = useAgentEventsStore((s) => s.loadHistory)

  const task = tasks.find((t) => t.id === selectedTaskId)
  const agentRunId = task?.agent_run_id ?? null
  const agentEvents = useAgentEventsStore((s) => (agentRunId ? (s.events[agentRunId] ?? null) : null))

  useEffect(() => {
    if (agentRunId) loadHistory(agentRunId)
  }, [agentRunId, loadHistory])

  const agentRuns = useMemo(() => extractTestRuns(agentEvents ?? []), [agentEvents])
  const lastAgentRun = agentRuns.length > 0 ? agentRuns[agentRuns.length - 1] : null
  const results = task?.verification_results ?? null

  if (!task) {
    return <div className="cr-tests__empty">No task selected.</div>
  }

  return (
    <div className="cr-verification">
      <section className="cr-verification__section">
        <h3 className="cr-verification__section-heading">FLEET Verified</h3>
        {results === null ? (
          <p className="cr-verification__empty">No FLEET verification record for this task.</p>
        ) : (
          <table className="cr-verification__table">
            <tbody>
              <VerificationRow label="Type check" record={results.typecheck} />
              <VerificationRow label="Tests" record={results.tests} />
            </tbody>
          </table>
        )}
      </section>

      <section className="cr-verification__section">
        <h3 className="cr-verification__section-heading">Agent Test Runs</h3>
        {lastAgentRun === null ? (
          <p className="cr-verification__empty">No test commands detected in agent session.</p>
        ) : (
          <div className="cr-tests__run">
            {agentRuns.length > 1 && (
              <p className="cr-tests__count">Showing latest of {agentRuns.length} test runs</p>
            )}
            <div className="cr-tests__command">$ {lastAgentRun.command}</div>
            <div className={`cr-tests__status ${lastAgentRun.success ? 'cr-tests__status--pass' : 'cr-tests__status--fail'}`}>
              {lastAgentRun.success ? 'Passed' : 'Failed'}
            </div>
            <pre className="cr-tests__output">{lastAgentRun.output || '(no output captured)'}</pre>
          </div>
        )}
      </section>
    </div>
  )
}

function VerificationRow({
  label,
  record
}: {
  label: string
  record: VerificationRecord | null
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  if (record === null) {
    return (
      <tr className="cr-verification__row cr-verification__row--skipped">
        <td className="cr-verification__label">{label}</td>
        <td className="cr-verification__status">—</td>
        <td className="cr-verification__duration" />
      </tr>
    )
  }

  const passed = record.exitCode === 0
  const durationSec = (record.durationMs / 1000).toFixed(1)
  const output = [record.stdout, record.stderr].filter((s) => s.length > 0).join('\n')

  return (
    <>
      <tr
        className={`cr-verification__row ${passed ? 'cr-verification__row--pass' : 'cr-verification__row--fail'}`}
        onClick={() => setExpanded((e) => !e)}
        style={{ cursor: output ? 'pointer' : 'default' }}
      >
        <td className="cr-verification__label">{label}</td>
        <td className="cr-verification__status">{passed ? '✅ Passed' : '❌ Failed'}</td>
        <td className="cr-verification__duration">{durationSec}s</td>
      </tr>
      {expanded && output && (
        <tr className="cr-verification__output-row">
          <td colSpan={3}>
            <pre className="cr-verification__output">{output}</pre>
            {record.truncated && (
              <p className="cr-verification__truncated">output truncated at 10 000 chars</p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- VerificationTab
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/code-review/VerificationTab.tsx \
        src/renderer/src/components/code-review/__tests__/VerificationTab.test.tsx
git commit -m "feat(code-review): add VerificationTab with FLEET gate results and agent test runs"
```

---

## Task 8: wire up Verification tab — store, panel, delete TestsTab

**Files:**
- Modify: `src/renderer/src/stores/codeReview.ts`
- Modify: `src/renderer/src/components/code-review/DiffViewerPanel.tsx`
- Delete: `src/renderer/src/components/code-review/TestsTab.tsx`

- [ ] **Step 1: Update DiffMode in codeReview.ts**

In `src/renderer/src/stores/codeReview.ts`, update the type and initial state:

```typescript
// Before:
export type DiffMode = 'diff' | 'commits' | 'tests'

// After:
export type DiffMode = 'diff' | 'commits' | 'verification'
```

Update the initial state and reset (both occurrences of `'diff'` as DiffMode are fine; look for `diffMode: 'diff' as DiffMode`):

No change needed to the initial value — `'diff'` is still the default. But add a hydration guard to handle any persisted `'tests'` value from before this change. Find the store's `persist` / rehydrate logic or `setDiffMode` and add:

```typescript
// In the store initializer or a separate onRehydrateStorage, add:
setDiffMode: (mode): void =>
  set({ diffMode: mode === ('tests' as DiffMode) ? 'verification' : mode }),
```

If the store does not use `persist`, skip the hydration guard — `diffMode` is runtime state only and resets on reload.

- [ ] **Step 2: Update DiffViewerPanel.tsx**

In `src/renderer/src/components/code-review/DiffViewerPanel.tsx`:

1. Replace the `modes` array:

```typescript
const modes: Array<{ key: DiffMode; label: string }> = [
  { key: 'diff', label: 'Diff' },
  { key: 'commits', label: 'Commits' },
  { key: 'verification', label: 'Verification' }
]
```

2. Replace the `<TestsTab />` import and render:

```typescript
// Remove:
import { TestsTab } from './TestsTab'

// Add:
import { VerificationTab } from './VerificationTab'
```

```typescript
// Replace:
{diffMode === 'tests' && <TestsTab />}

// With:
{diffMode === 'verification' && <VerificationTab />}
```

- [ ] **Step 3: Delete TestsTab.tsx**

```bash
git rm src/renderer/src/components/code-review/TestsTab.tsx
```

If a `__tests__/TestsTab.test.tsx` exists, delete it too:

```bash
git rm src/renderer/src/components/code-review/__tests__/TestsTab.test.tsx 2>/dev/null || true
```

- [ ] **Step 4: Run typecheck and full test suite**

```bash
npm run typecheck && npm test
```

Fix any import errors (e.g., other files importing from `TestsTab`). Search:

```bash
grep -r "TestsTab" src/ --include="*.ts" --include="*.tsx"
```

For each match, update the import to `VerificationTab`.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/codeReview.ts \
        src/renderer/src/components/code-review/DiffViewerPanel.tsx
git commit -m "feat(code-review): rename Tests tab to Verification; wire VerificationTab"
```

---

## Task 9: update module docs and run full verification

**Files:**
- Modify: `docs/modules/components/index.md`
- Modify: `docs/modules/services/index.md` (if verify-worktree is listed)

- [ ] **Step 1: Update docs/modules/components/index.md**

Find the row for `TestsTab.tsx` and replace with:

```
| VerificationTab | code-review | `src/renderer/src/components/code-review/VerificationTab.tsx` | Two-section verification panel: FLEET gate results (typecheck + tests) and agent test runs |
```

- [ ] **Step 2: Run the full suite**

```bash
npm run typecheck && npm test && npm run lint
```

Expected: zero errors, all tests pass. Lint warnings are pre-existing (prettier style) — zero errors required.

- [ ] **Step 3: Final commit**

```bash
git add docs/
git commit -m "docs: update module index for VerificationTab"
```
