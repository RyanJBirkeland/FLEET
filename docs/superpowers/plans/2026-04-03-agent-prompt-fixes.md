# Agent Prompt Injection & Optimization

**Date:** 2026-04-03
**Branch:** `feat/csuite-audit-fixes`
**Spec:** `docs/superpowers/specs/2026-04-03-agent-prompt-audit.md`
**Test command:** `npm run test:main`

---

## Goal

Inject critical runtime context (retry info, time limits, idle warnings, definition of done) into pipeline agent prompts and optimize existing prompt content (de-duplicate personality/preamble, fix dead `patterns` field, add commit/scope quality standards). All changes are main-process-only, touching `prompt-composer.ts`, `run-agent.ts`, `types.ts`, and `pipeline-personality.ts`, with TDD via `prompt-composer.test.ts`.

---

## Architecture

### Files Modified

| File | Change |
|------|--------|
| `src/main/agent-manager/prompt-composer.ts` | Add 6 conditional sections to `buildAgentPrompt()`, update `BuildPromptInput` interface |
| `src/main/agent-manager/run-agent.ts` | Pass `retryCount`, `previousNotes`, `maxRuntimeMs` to `buildAgentPrompt()` |
| `src/main/agent-manager/types.ts` | No changes needed (constants already exported) |
| `src/main/agent-system/personality/pipeline-personality.ts` | De-duplicate constraints, inject `patterns`, add scope enforcement |
| `src/main/agent-system/personality/types.ts` | No changes needed (`patterns` already in interface) |
| `src/main/agent-manager/__tests__/prompt-composer.test.ts` | Add tests for all 11 features |

### Data Flow

```
run-agent.ts
  └─ reads task.retry_count, task.notes, task.max_runtime_ms
  └─ passes to buildAgentPrompt({ retryCount, previousNotes, maxRuntimeMs, ... })
       └─ prompt-composer.ts conditionally appends:
            - ## Retry Context (when retryCount > 0)
            - ## Time Management (when maxRuntimeMs provided)
            - ## Idle Timeout Warning (always for pipeline)
            - ## Definition of Done (always for pipeline)
            - ## Scope Boundaries (always for pipeline, from personality)
            - ## Self-Review Checklist (always for pipeline)
            - patterns[] injected into prompt (all agent types)
```

### Constants Used

- `MAX_RETRIES = 3` (from `types.ts`)
- `DEFAULT_CONFIG.maxRuntimeMs = 3_600_000` (1 hour)
- `DEFAULT_CONFIG.idleTimeoutMs = 900_000` (15 minutes)

---

## Tasks

### Task 1: Add `retryCount`, `previousNotes`, `maxRuntimeMs` to `BuildPromptInput`

**Test first** — `src/main/agent-manager/__tests__/prompt-composer.test.ts`:

```typescript
describe('retry context injection', () => {
  it('does not include retry section when retryCount is 0', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something',
      retryCount: 0
    })
    expect(prompt).not.toContain('## Retry Context')
  })

  it('does not include retry section when retryCount is undefined', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something'
    })
    expect(prompt).not.toContain('## Retry Context')
  })

  it('includes retry section when retryCount > 0', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something',
      retryCount: 2,
      previousNotes: 'npm test failed — missing mock for better-sqlite3'
    })
    expect(prompt).toContain('## Retry Context')
    expect(prompt).toContain('attempt 3 of 4')
    expect(prompt).toContain('npm test failed — missing mock for better-sqlite3')
    expect(prompt).toContain('Do NOT repeat the same approach')
  })

  it('handles retryCount > 0 with no previousNotes', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something',
      retryCount: 1
    })
    expect(prompt).toContain('## Retry Context')
    expect(prompt).toContain('attempt 2 of 4')
    expect(prompt).toContain('No failure notes from previous attempt')
  })

  it('does not include retry section for non-pipeline agents', () => {
    const prompt = buildAgentPrompt({
      agentType: 'assistant',
      retryCount: 2,
      previousNotes: 'some failure'
    })
    expect(prompt).not.toContain('## Retry Context')
  })
})
```

**Implementation** — `src/main/agent-manager/prompt-composer.ts`:

Add to `BuildPromptInput`:

```typescript
export interface BuildPromptInput {
  agentType: AgentType
  taskContent?: string
  branch?: string
  playgroundEnabled?: boolean
  messages?: Array<{ role: string; content: string }>
  formContext?: { title: string; repo: string; spec: string }
  codebaseContext?: string
  retryCount?: number          // NEW: 0-based retry count
  previousNotes?: string       // NEW: failure notes from previous attempt
  maxRuntimeMs?: number | null // NEW: max runtime in milliseconds
}
```

Add builder function (after `buildBranchAppendix`):

```typescript
const MAX_RETRIES_FOR_DISPLAY = 3 // matches MAX_RETRIES from types.ts

function buildRetryContext(retryCount: number, previousNotes?: string): string {
  const attemptNum = retryCount + 1
  const maxAttempts = MAX_RETRIES_FOR_DISPLAY + 1
  const notesText = previousNotes
    ? `Previous attempt failed: ${previousNotes}`
    : 'No failure notes from previous attempt.'

  return `

## Retry Context
This is attempt ${attemptNum} of ${maxAttempts}. ${notesText}
Do NOT repeat the same approach. Analyze what went wrong and try a different strategy.
If the previous failure was a test/typecheck error, fix that specific error first.`
}
```

In `buildAgentPrompt()`, after task content injection (before `return prompt`):

```typescript
// Inject retry context for pipeline agents with retries
if (agentType === 'pipeline' && retryCount && retryCount > 0) {
  prompt += buildRetryContext(retryCount, previousNotes)
}
```

**Caller update** — `src/main/agent-manager/run-agent.ts`:

Change the `buildAgentPrompt()` call (line ~181):

```typescript
const prompt = buildAgentPrompt({
  agentType: 'pipeline',
  taskContent,
  branch: worktree.branch,
  playgroundEnabled: task.playground_enabled,
  retryCount: task.retry_count ?? 0,
  previousNotes: undefined, // notes are on the task but need to be read
  maxRuntimeMs: task.max_runtime_ms
})
```

We need `task.notes` available. Update `RunAgentTask` interface to include `notes`:

```typescript
export interface RunAgentTask {
  id: string
  title: string
  prompt: string | null
  spec: string | null
  repo: string
  retry_count: number
  fast_fail_count: number
  playground_enabled?: boolean
  max_runtime_ms?: number | null
  notes?: string | null          // NEW: failure notes from previous attempt
}
```

Then the caller becomes:

```typescript
const prompt = buildAgentPrompt({
  agentType: 'pipeline',
  taskContent,
  branch: worktree.branch,
  playgroundEnabled: task.playground_enabled,
  retryCount: task.retry_count ?? 0,
  previousNotes: task.notes ?? undefined,
  maxRuntimeMs: task.max_runtime_ms
})
```

**Verify:** `npx vitest run --config src/main/vitest.main.config.ts src/main/agent-manager/__tests__/prompt-composer.test.ts`

---

### Task 2: Inject Time Limit

**Test first** — `src/main/agent-manager/__tests__/prompt-composer.test.ts`:

```typescript
describe('time limit injection', () => {
  it('includes time limit when maxRuntimeMs is provided', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something',
      maxRuntimeMs: 3_600_000 // 60 minutes
    })
    expect(prompt).toContain('## Time Management')
    expect(prompt).toContain('60 minutes')
    expect(prompt).toContain('Budget 70% for implementation')
    expect(prompt).toContain('Commit early')
  })

  it('rounds partial minutes correctly', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something',
      maxRuntimeMs: 2_700_000 // 45 minutes
    })
    expect(prompt).toContain('45 minutes')
  })

  it('does not include time limit when maxRuntimeMs is undefined', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something'
    })
    expect(prompt).not.toContain('## Time Management')
  })

  it('does not include time limit when maxRuntimeMs is null', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something',
      maxRuntimeMs: null
    })
    expect(prompt).not.toContain('## Time Management')
  })

  it('does not include time limit for non-pipeline agents', () => {
    const prompt = buildAgentPrompt({
      agentType: 'assistant',
      maxRuntimeMs: 3_600_000
    })
    expect(prompt).not.toContain('## Time Management')
  })
})
```

**Implementation** — `src/main/agent-manager/prompt-composer.ts`:

```typescript
function buildTimeLimitSection(maxRuntimeMs: number): string {
  const minutes = Math.round(maxRuntimeMs / 60_000)
  return `

## Time Management
You have a maximum of ${minutes} minutes. You will be killed with NO WARNING if you exceed this.
Budget 70% for implementation, 30% for testing and verification.
Commit early — uncommitted work is LOST if you are terminated.`
}
```

In `buildAgentPrompt()`:

```typescript
if (agentType === 'pipeline' && maxRuntimeMs != null && maxRuntimeMs > 0) {
  prompt += buildTimeLimitSection(maxRuntimeMs)
}
```

Extract `maxRuntimeMs` from input destructuring:

```typescript
const { agentType, taskContent, branch, playgroundEnabled, messages, codebaseContext,
        retryCount, previousNotes, maxRuntimeMs } = input
```

---

### Task 3: Make npm install Unconditionally First

**Test first** — `src/main/agent-manager/__tests__/prompt-composer.test.ts`:

```typescript
describe('npm install instruction', () => {
  it('tells pipeline agents to run npm install as FIRST action unconditionally', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something'
    })
    // Must NOT contain the conditional version
    expect(prompt).not.toContain('if node_modules/ is missing')
    // Must contain the unconditional version
    expect(prompt).toContain('FIRST action')
    expect(prompt).toContain('npm install')
  })
})
```

**Implementation** — `src/main/agent-manager/prompt-composer.ts`:

Change line in `UNIVERSAL_PREAMBLE`:

```
Old: - Run `npm install` if node_modules/ is missing or incomplete before starting work
New: - Run `npm install` as your FIRST action — worktrees have NO node_modules
```

**Note:** This also requires updating the existing test on line 25 of `prompt-composer.test.ts` which currently asserts:
```typescript
expect(prompt).toContain('Run `npm install` if node_modules/ is missing')
```

Change to:
```typescript
expect(prompt).toContain('Run `npm install` as your FIRST action')
```

---

### Task 4: Add Idle Timeout Warning

**Test first** — `src/main/agent-manager/__tests__/prompt-composer.test.ts`:

```typescript
describe('idle timeout warning', () => {
  it('includes idle timeout warning for pipeline agents', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something'
    })
    expect(prompt).toContain('terminated if you produce no output for 15 minutes')
  })

  it('does not include idle timeout warning for non-pipeline agents', () => {
    const prompt = buildAgentPrompt({ agentType: 'assistant' })
    expect(prompt).not.toContain('terminated if you produce no output')
  })
})
```

**Implementation** — `src/main/agent-manager/prompt-composer.ts`:

Add constant:

```typescript
const IDLE_TIMEOUT_WARNING = `
You will be terminated if you produce no output for 15 minutes.
If running long commands, emit a progress note before and after.`
```

In `buildAgentPrompt()`, in the pipeline-only section:

```typescript
if (agentType === 'pipeline') {
  prompt += '\n' + IDLE_TIMEOUT_WARNING
}
```

This goes right after the time management section injection.

---

### Task 5: Add Definition of Done

**Test first** — `src/main/agent-manager/__tests__/prompt-composer.test.ts`:

```typescript
describe('definition of done', () => {
  it('includes definition of done for pipeline agents', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something'
    })
    expect(prompt).toContain('## Definition of Done')
    expect(prompt).toContain('all changes committed')
    expect(prompt).toContain('npm run typecheck')
    expect(prompt).toContain('npm test')
    expect(prompt).toContain('npm run lint')
  })

  it('does not include definition of done for copilot agents', () => {
    const prompt = buildAgentPrompt({
      agentType: 'copilot',
      messages: [{ role: 'user', content: 'help' }]
    })
    expect(prompt).not.toContain('## Definition of Done')
  })
})
```

**Implementation** — `src/main/agent-manager/prompt-composer.ts`:

Add constant:

```typescript
const DEFINITION_OF_DONE = `

## Definition of Done
Your task is complete when ALL of these are true:
1. All changes are committed to your branch
2. \`npm run typecheck\` passes with zero errors
3. \`npm test\` passes (all renderer tests)
4. \`npm run lint\` passes with zero errors
A human will review your diff. Keep changes focused and minimal.`
```

In `buildAgentPrompt()`:

```typescript
if (agentType === 'pipeline') {
  prompt += DEFINITION_OF_DONE
}
```

---

### Task 6: Add Scope Boundary Enforcement

**Test first** — `src/main/agent-manager/__tests__/prompt-composer.test.ts`:

```typescript
describe('scope boundary enforcement', () => {
  it('includes scope boundaries for pipeline agents', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something'
    })
    expect(prompt).toContain('Only modify files directly required by the task spec')
    expect(prompt).toContain('Do not refactor adjacent code')
  })

  it('does not include scope boundaries for adhoc agents', () => {
    const prompt = buildAgentPrompt({
      agentType: 'adhoc',
      taskContent: 'Explore the codebase'
    })
    expect(prompt).not.toContain('Only modify files directly required')
  })
})
```

**Implementation** — `src/main/agent-system/personality/pipeline-personality.ts`:

Add to `constraints` array:

```typescript
constraints: [
  'NEVER push to main - only to your assigned branch',
  'NEVER commit secrets or .env files',
  'Only modify files directly required by the task spec. Do not refactor adjacent code.',
  'Every file you touch must be justified by a spec requirement'
],
```

Remove the duplicated constraints that are already in the universal preamble:
- Remove: `'Run npm install if node_modules/ is missing'` (covered by preamble)
- Remove: `'Run tests after changes: npm test && npm run typecheck'` (covered by preamble's MANDATORY Pre-Commit Verification)
- Remove: `'Use TypeScript strict mode conventions'` (covered by preamble)

Final constraints array:

```typescript
constraints: [
  'NEVER push to main - only to your assigned branch',
  'NEVER commit secrets or .env files',
  'Only modify files directly required by the task spec. Do not refactor adjacent code.',
  'Every file you touch must be justified by a spec requirement'
],
```

This also covers **Task 7: De-duplicate Personality vs Preamble**.

---

### Task 7: De-duplicate Personality vs Preamble

Covered by Task 6 above. The pipeline personality's `constraints` had 3 entries that are word-for-word duplicates of the universal preamble:

| Constraint (personality) | Already in preamble? |
|---|---|
| `NEVER push to main` | Yes — "NEVER push to, checkout, or merge into `main`" |
| `Run npm install if node_modules/ is missing` | Yes — Hard Rules bullet |
| `Run tests after changes` | Yes — MANDATORY Pre-Commit Verification |
| `Use TypeScript strict mode conventions` | Yes — Hard Rules bullet |

**Keep** `NEVER push to main` (it's phrased differently and reinforcement is valuable).
**Remove** the other 3.

**Test update** — the existing test on line 41 asserts `expect(prompt).toContain('NEVER push to main')`. This still passes. The removed constraints aren't asserted anywhere.

---

### Task 8: Fix Dead `patterns` Field

**Test first** — `src/main/agent-manager/__tests__/prompt-composer.test.ts`:

```typescript
describe('personality patterns injection', () => {
  it('includes patterns from pipeline personality', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something'
    })
    expect(prompt).toContain('## Behavioral Patterns')
    expect(prompt).toContain('Report what you did, not what you plan to do')
    expect(prompt).toContain('If tests fail, fix them before pushing')
  })

  it('includes patterns for all agent types that have them', () => {
    // Pipeline has patterns
    const pipeline = buildAgentPrompt({ agentType: 'pipeline' })
    expect(pipeline).toContain('## Behavioral Patterns')
  })
})
```

**Implementation** — `src/main/agent-manager/prompt-composer.ts`:

After the constraints injection (line ~153), add:

```typescript
// Inject behavioral patterns if the personality defines them
if (personality.patterns.length > 0) {
  prompt += '\n\n## Behavioral Patterns\n' + personality.patterns.map((p) => `- ${p}`).join('\n')
}
```

---

### Task 9: Commit Message Quality Standard

**Test first** — `src/main/agent-manager/__tests__/prompt-composer.test.ts`:

```typescript
describe('commit message quality standard', () => {
  it('includes commit message format for pipeline agents', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something'
    })
    expect(prompt).toContain('{type}({scope}): {what}')
    expect(prompt).toContain('why')
  })
})
```

**Implementation** — update `pipeline-personality.ts` patterns array:

```typescript
patterns: [
  'Report what you did, not what you plan to do',
  'If tests fail, fix them before pushing',
  'Commit format: {type}({scope}): {what} — {why}. The "why" clause is mandatory.',
],
```

This replaces the old `'Commit with format: {type}: {description}'` pattern with the improved format that requires a `why` clause.

---

### Task 10: Agent Self-Review Checklist

**Test first** — `src/main/agent-manager/__tests__/prompt-composer.test.ts`:

```typescript
describe('self-review checklist', () => {
  it('includes self-review checklist for pipeline agents', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something'
    })
    expect(prompt).toContain('## Self-Review Checklist')
    expect(prompt).toContain('Every changed file is required by the spec')
    expect(prompt).toContain('No console.log')
    expect(prompt).toContain('No hardcoded colors')
    expect(prompt).toContain('preload .d.ts updated')
  })

  it('does not include self-review checklist for assistant agents', () => {
    const prompt = buildAgentPrompt({ agentType: 'assistant' })
    expect(prompt).not.toContain('## Self-Review Checklist')
  })
})
```

**Implementation** — `src/main/agent-manager/prompt-composer.ts`:

Add constant:

```typescript
const SELF_REVIEW_CHECKLIST = `

## Self-Review Checklist
Before your final commit, verify:
- Every changed file is required by the spec
- No console.log, commented-out code, or TODO left behind
- No hardcoded colors or magic numbers
- Tests cover error states, not just happy paths
- If IPC channels changed, preload .d.ts updated and handler count test updated`
```

In `buildAgentPrompt()`:

```typescript
if (agentType === 'pipeline') {
  prompt += SELF_REVIEW_CHECKLIST
}
```

---

### Task 11: Pre-commit Evidence in Commit Message

**Test first** — `src/main/agent-manager/__tests__/prompt-composer.test.ts`:

```typescript
describe('pre-commit evidence', () => {
  it('instructs pipeline agents to include verification summary', () => {
    const prompt = buildAgentPrompt({
      agentType: 'pipeline',
      taskContent: 'Do something'
    })
    expect(prompt).toContain('Verified:')
    expect(prompt).toContain('typecheck OK')
    expect(prompt).toContain('tests passed')
    expect(prompt).toContain('lint 0 errors')
  })
})
```

**Implementation** — Add to `DEFINITION_OF_DONE` constant (append after the existing text):

```typescript
const DEFINITION_OF_DONE = `

## Definition of Done
Your task is complete when ALL of these are true:
1. All changes are committed to your branch
2. \`npm run typecheck\` passes with zero errors
3. \`npm test\` passes (all renderer tests)
4. \`npm run lint\` passes with zero errors
A human will review your diff. Keep changes focused and minimal.

Include a verification summary as the last line of your final commit message:
\`Verified: typecheck OK, N tests passed, lint 0 errors\``
```

---

## Implementation Order

Execute tasks in this order (each builds on the previous):

1. **Task 3** — npm install fix (modifies `UNIVERSAL_PREAMBLE` + updates existing test assertion)
2. **Task 8** — Fix dead `patterns` field (adds `patterns` injection to prompt builder)
3. **Tasks 6+7** — Scope boundaries + de-duplicate (modifies `pipeline-personality.ts` constraints)
4. **Task 9** — Commit message quality (modifies `pipeline-personality.ts` patterns)
5. **Task 1** — Retry context (adds `BuildPromptInput` fields + builder function + `run-agent.ts` caller)
6. **Task 2** — Time limit (adds builder function + conditional injection)
7. **Task 4** — Idle timeout warning (adds constant + conditional injection)
8. **Tasks 5+11** — Definition of done + evidence (adds constant with combined content)
9. **Task 10** — Self-review checklist (adds constant + conditional injection)

## Section Ordering in Final Prompt

After all changes, the pipeline agent prompt structure will be:

```
UNIVERSAL_PREAMBLE (who you are, hard rules, pre-commit verification)
## Voice (from personality)
## Your Role (from personality)
## Constraints (from personality — de-duplicated)
## Behavioral Patterns (from personality — newly injected)
## BDE Conventions (memory modules)
## User Knowledge (if any active memory files)
## Note (plugin disable)
## Git Branch (if branch provided)
## Dev Playground (if playground enabled)
{task content — spec or prompt}
## Time Management (if maxRuntimeMs provided)
{idle timeout warning}
## Retry Context (if retryCount > 0)
## Definition of Done (always for pipeline)
## Self-Review Checklist (always for pipeline)
```

## Verification

After all tasks complete:

```bash
# Run prompt-composer tests specifically
npx vitest run --config src/main/vitest.main.config.ts src/main/agent-manager/__tests__/prompt-composer.test.ts

# Run all main process tests
npm run test:main

# Full CI gate
npm run typecheck && npm test && npm run lint
```
