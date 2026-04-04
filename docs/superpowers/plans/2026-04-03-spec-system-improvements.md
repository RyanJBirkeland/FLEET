# Plan: Spec System & Readiness Improvements

**Date:** 2026-04-03
**Spec:** `docs/superpowers/specs/2026-04-03-agent-prompt-audit.md` (Tier 3, items 13-16)
**Scope:** 8 features across 4 files (renderer) + 3 files (main/shared) + tests

---

## Overview

The Copilot hallucinates file paths because it cannot access the codebase. The readiness checks use Haiku to guess if paths exist instead of calling `fs.stat()`. Specs with research language ("explore," "investigate") pass validation despite being unexecutable by pipeline agents. This plan wires the orphaned `workbench:researchRepo` handler into Copilot, replaces AI-guessed file validation with real `fs.stat()` calls, and adds 5 new structural/semantic readiness checks.

---

## Feature 1: Wire `workbench:researchRepo` to Copilot

### Problem
`WorkbenchCopilot.tsx` sends user messages to `workbench:chatStream` (text-only AI). The `workbench:researchRepo` IPC handler exists and does real grep -- but nothing calls it from the Copilot flow. The "Research Codebase" button in `SpecEditor.tsx` sends a text message to the Copilot via `onSendCopilotMessage`, which just adds it to the chat stream -- no actual codebase research happens.

### Solution
Before sending user messages to the AI, detect research-intent queries and call `workbench:researchRepo` first. Inject the grep results as a system message in the conversation, then send the augmented context to the AI so it can synthesize real data instead of hallucinating.

### Files to Change

1. **`src/renderer/src/components/task-workbench/WorkbenchCopilot.tsx`**
   - In `handleSend()`, before calling `workbench:chatStream`, detect research intent:
     ```ts
     const RESEARCH_PATTERNS = [
       /research|search|find|look for|grep|where is|which file|show me/i
     ]
     function isResearchQuery(text: string): boolean {
       return RESEARCH_PATTERNS.some(p => p.test(text))
     }
     ```
   - If research intent detected AND `repo` is set:
     1. Call `window.api.workbench.researchRepo({ query: extractSearchTerms(text), repo })`
     2. Add a system message with the research results: `{ role: 'system', content: 'Codebase research results:\n' + result.content }`
     3. Include the system message in the `allMessages` array sent to `chatStream`
   - `extractSearchTerms(text)` strips common prefixes like "research the codebase for" / "find" / "where is" to get the actual search query

2. **`src/renderer/src/stores/taskWorkbench.ts`**
   - No store changes needed -- system messages already supported via `CopilotMessage.role = 'system'`

### Tests

**File:** `src/renderer/src/components/task-workbench/__tests__/WorkbenchCopilot.test.tsx`

Add tests:
- `it('calls researchRepo when message contains research intent')` -- mock `window.api.workbench.researchRepo`, type "research the auth module", verify IPC called with `{ query: 'auth module', repo: 'BDE' }`
- `it('injects research results as system message before AI call')` -- verify the system message appears in the messages array passed to `chatStream`
- `it('skips research for non-research queries')` -- type "help me write a better title", verify `researchRepo` NOT called
- `it('handles researchRepo failure gracefully')` -- mock rejection, verify chat still proceeds without research context
- `it('extracts search terms from natural language')` -- unit test `extractSearchTerms()` with inputs like "research the codebase for auth module" -> "auth module", "where is the sprint pipeline?" -> "sprint pipeline"

**Run:** `npx vitest run src/renderer/src/components/task-workbench/__tests__/WorkbenchCopilot.test.tsx`

---

## Feature 2: Real File Existence Validation in Readiness Checks

### Problem
`spec-semantic-check.ts` asks Haiku "do these paths look plausible?" -- a language model guessing about file existence. The `workbench:checkSpec` handler already returns a `filesExist` field, but it is AI-generated.

### Solution
Add a new IPC handler `workbench:checkFiles` that extracts file paths from the spec via regex and calls `fs.stat()` on each. Wire it into the Tier 2 checks in `WorkbenchForm.tsx` alongside the existing semantic checks.

### Files to Change

1. **`src/main/handlers/workbench.ts`**
   - Add new handler `workbench:checkFiles`:
     ```ts
     safeHandle('workbench:checkFiles', async (_e, input: { spec: string; repo: string }) => {
       const { spec, repo } = input
       const repoPaths = getRepoPaths()
       const repoPath = repoPaths[repo]
       if (!repoPath) return { status: 'warn', message: 'Repo path not configured', paths: [] }

       // Extract file paths from spec using regex
       const pathRegex = /(?:^|\s)(src\/[\w/.-]+\.\w+)/gm
       const paths: string[] = []
       let match
       while ((match = pathRegex.exec(spec)) !== null) {
         if (!paths.includes(match[1])) paths.push(match[1])
       }

       if (paths.length === 0) {
         return { status: 'warn', message: 'No file paths found in spec', paths: [] }
       }

       const { stat } = await import('fs/promises')
       const { join } = await import('path')
       const results: Array<{ path: string; exists: boolean }> = []
       for (const p of paths) {
         try {
           await stat(join(repoPath, p))
           results.push({ path: p, exists: true })
         } catch {
           results.push({ path: p, exists: false })
         }
       }

       const missing = results.filter(r => !r.exists)
       if (missing.length === 0) {
         return { status: 'pass', message: `All ${paths.length} referenced files exist`, paths }
       }
       return {
         status: 'fail',
         message: `${missing.length} file(s) not found: ${missing.map(m => m.path).join(', ')}`,
         paths,
         missing: missing.map(m => m.path)
       }
     })
     ```

2. **`src/preload/index.ts`** -- Add `checkFiles` to the workbench namespace:
   ```ts
   checkFiles: (input: { spec: string; repo: string }) =>
     typedInvoke('workbench:checkFiles', input),
   ```

3. **`src/preload/index.d.ts`** -- Add type declaration for `checkFiles`

4. **`src/shared/ipc-channels.ts`** -- Add `'workbench:checkFiles'` to the channel list

5. **`src/renderer/src/components/task-workbench/WorkbenchForm.tsx`**
   - In the debounced semantic checks `useEffect`, after `window.api.workbench.checkSpec()`, also call `window.api.workbench.checkFiles({ spec, repo })`:
     ```ts
     const [semanticResult, fileResult] = await Promise.all([
       window.api.workbench.checkSpec({ title, repo, spec, specType }),
       window.api.workbench.checkFiles({ spec, repo })
     ])
     ```
   - Replace the AI-based `files-exist` check with the real one from `fileResult`

### Tests

**File:** `src/main/handlers/__tests__/workbench.test.ts`

- Update handler count test: `expect(safeHandle).toHaveBeenCalledTimes(8)` (was 7)
- `it('checkFiles handler extracts paths and validates existence')` -- mock `fs.stat` to resolve for known paths, reject for unknown. Pass spec with `src/main/index.ts` and `src/fake/nonexistent.ts`. Verify result has `status: 'fail'` and `missing` array.
- `it('checkFiles returns warn when no paths found in spec')` -- pass spec with no `src/` paths
- `it('checkFiles returns pass when all paths exist')` -- mock all `fs.stat` to resolve

**File:** `src/renderer/src/components/task-workbench/__tests__/WorkbenchForm.test.tsx`

- `it('calls checkFiles alongside checkSpec for semantic checks')` -- verify both IPCs called
- `it('shows real file existence result instead of AI guess')` -- verify the `files-exist` check uses the `checkFiles` result

**Run:** `npx vitest run src/main/handlers/__tests__/workbench.test.ts src/renderer/src/components/task-workbench/__tests__/WorkbenchForm.test.tsx`

---

## Feature 3: Spec Anti-Pattern Linting (Tier 1 Structural Check)

### Problem
Specs with "explore," "investigate," "find issues," "improve where needed" cause agents to thrash. Pipeline agents need explicit execution instructions, not exploration directives.

### Solution
Add to `computeStructuralChecks()` in `useReadinessChecks.ts`. This is a pure synchronous check -- no IPC needed.

### Files to Change

1. **`src/renderer/src/hooks/useReadinessChecks.ts`**
   - In `computeStructuralChecks()`, after the existing checks, add:
     ```ts
     // Anti-pattern detection: research/exploration language
     const ANTI_PATTERNS = [
       /\bexplore\b/i,
       /\binvestigate\b/i,
       /\bfind issues\b/i,
       /\bimprove where needed\b/i,
       /\bidentify.*problems\b/i,
       /\blook into\b/i,
       /\banalyze and fix\b/i,
       /\bclean up as needed\b/i,
       /\brefactor as necessary\b/i,
       /\bfix any\b/i
     ]
     const foundPatterns = ANTI_PATTERNS.filter(p => p.test(form.spec))
     if (foundPatterns.length > 0) {
       checks.push({
         id: 'no-exploration-language',
         label: 'Actionable',
         tier: 1,
         status: 'warn',
         message: 'Spec contains exploration language -- pipeline agents need explicit instructions, not research directives'
       })
     } else if (form.spec.trim().length > 0) {
       checks.push({
         id: 'no-exploration-language',
         label: 'Actionable',
         tier: 1,
         status: 'pass',
         message: 'No exploration anti-patterns detected'
       })
     }
     ```

### Tests

**File:** `src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts`

Add new `describe('anti-pattern detection')`:
- `it('warns when spec contains "explore"')` -- spec: "Explore the auth module and find issues" -> warn
- `it('warns when spec contains "investigate"')` -- spec: "Investigate why tests fail" -> warn
- `it('warns when spec contains "improve where needed"')` -> warn
- `it('warns when spec contains "fix any"')` -- spec: "Fix any linting errors" -> warn
- `it('passes for explicit instructions')` -- spec: "Add a retry counter to buildAgentPrompt in src/main/agent-manager/prompt-composer.ts" -> pass
- `it('does not add check when spec is empty')` -- spec: "" -> no `no-exploration-language` check present

**Run:** `npx vitest run src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts`

---

## Feature 4: Test Section Detection (Tier 1 Structural Check)

### Problem
Agents skip testing when the spec does not mention it. Detecting the absence of a test section early prevents review rejections.

### Solution
Add to `computeStructuralChecks()` -- scan for `## Test`, `## How to Test`, `## Testing`, `## Verification`, or `## Test Strategy`.

### Files to Change

1. **`src/renderer/src/hooks/useReadinessChecks.ts`**
   - In `computeStructuralChecks()`, after the anti-pattern check:
     ```ts
     // Test section detection
     if (form.spec.trim().length > 0) {
       const hasTestSection = /^##\s*(Tests?|How to Test|Testing|Verification|Test Strategy|Test Plan)/im.test(form.spec)
       checks.push({
         id: 'test-section',
         label: 'Test Plan',
         tier: 1,
         status: hasTestSection ? 'pass' : 'warn',
         message: hasTestSection
           ? 'Test section found'
           : 'No test section -- add ## How to Test or ## Verification'
       })
     }
     ```

### Tests

**File:** `src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts`

Add new `describe('test section detection')`:
- `it('passes when spec has ## How to Test')` -- pass
- `it('passes when spec has ## Testing')` -- pass
- `it('passes when spec has ## Verification')` -- pass
- `it('passes when spec has ## Test Strategy')` -- pass
- `it('warns when spec has no test section')` -- spec with `## Problem` and `## Solution` only -> warn
- `it('does not check when spec is empty')` -- no `test-section` check

**Run:** `npx vitest run src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts`

---

## Feature 5: Handler Count Awareness (Tier 1 Structural Check)

### Problem
Agents add IPC handlers but forget to update handler count tests, causing CI failures.

### Solution
Add a pure structural check that detects handler-related keywords and checks for corresponding test mentions.

### Files to Change

1. **`src/renderer/src/hooks/useReadinessChecks.ts`**
   - In `computeStructuralChecks()`:
     ```ts
     // Handler count awareness
     if (form.spec.trim().length > 0) {
       const mentionsHandler = /\bsafeHandle\b|\bIPC handler\b|\bregister.*handler/i.test(form.spec)
       if (mentionsHandler) {
         const mentionsHandlerTest = /handler count|handler.*test|test.*handler|\.test\./i.test(form.spec)
         checks.push({
           id: 'handler-count',
           label: 'Handler Tests',
           tier: 1,
           status: mentionsHandlerTest ? 'pass' : 'warn',
           message: mentionsHandlerTest
             ? 'Handler test update mentioned'
             : 'Spec adds IPC handlers but does not mention updating handler count tests'
         })
       }
     }
     ```

### Tests

**File:** `src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts`

Add new `describe('handler count awareness')`:
- `it('warns when spec mentions safeHandle but not handler count test')` -- spec: "Add a new safeHandle for workbench:newFeature" -> warn
- `it('passes when spec mentions both handler and test update')` -- spec: "Add safeHandle... Update handler count test in workbench.test.ts" -> pass
- `it('skips check when no handler keywords')` -- spec: "Update CSS styling" -> no `handler-count` check

**Run:** `npx vitest run src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts`

---

## Feature 6: Preload Declaration Sync Warning (Tier 1 Structural Check)

### Problem
Agents add methods to `preload/index.ts` but forget `preload/index.d.ts`, causing typecheck failures.

### Solution
Pure structural check -- detect `preload/index.ts` mention without `preload/index.d.ts`.

### Files to Change

1. **`src/renderer/src/hooks/useReadinessChecks.ts`**
   - In `computeStructuralChecks()`:
     ```ts
     // Preload declaration sync
     if (form.spec.trim().length > 0) {
       const mentionsPreload = /preload\/index\.ts\b/.test(form.spec)
       if (mentionsPreload) {
         const mentionsPreloadDts = /preload\/index\.d\.ts\b/.test(form.spec)
         checks.push({
           id: 'preload-sync',
           label: 'Preload Sync',
           tier: 1,
           status: mentionsPreloadDts ? 'pass' : 'warn',
           message: mentionsPreloadDts
             ? 'Preload .d.ts update mentioned'
             : 'Spec mentions preload/index.ts but not preload/index.d.ts -- types will break'
         })
       }
     }
     ```

### Tests

**File:** `src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts`

Add new `describe('preload declaration sync')`:
- `it('warns when spec mentions preload/index.ts without .d.ts')` -- warn
- `it('passes when spec mentions both files')` -- pass
- `it('skips check when preload not mentioned')` -- no `preload-sync` check

**Run:** `npx vitest run src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts`

---

## Feature 7: Complexity Estimation (Tier 1 Structural Check)

### Problem
Specs referencing 15+ files are too broad for one agent session. No warning is given.

### Solution
Count distinct file paths in the spec. Warn at >8, fail at >15. This is a pure structural check.

### Files to Change

1. **`src/renderer/src/hooks/useReadinessChecks.ts`**
   - In `computeStructuralChecks()`:
     ```ts
     // Complexity estimation: count distinct file paths
     if (form.spec.trim().length > 0) {
       const pathMatches = form.spec.match(/(?:src|lib|test|docs)\/[\w/.-]+\.\w+/g) ?? []
       const uniquePaths = new Set(pathMatches)
       const fileCount = uniquePaths.size
       let complexityStatus: 'pass' | 'warn' | 'fail'
       let complexityMsg: string
       if (fileCount > 15) {
         complexityStatus = 'fail'
         complexityMsg = `${fileCount} files referenced -- too broad for one agent (max 15)`
       } else if (fileCount > 8) {
         complexityStatus = 'warn'
         complexityMsg = `${fileCount} files referenced -- consider splitting into smaller tasks`
       } else {
         complexityStatus = 'pass'
         complexityMsg = fileCount > 0 ? `${fileCount} file(s) referenced` : 'No file paths detected'
       }
       checks.push({
         id: 'complexity',
         label: 'Complexity',
         tier: 1,
         status: complexityStatus,
         message: complexityMsg
       })
     }
     ```

### Tests

**File:** `src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts`

Add new `describe('complexity estimation')`:
- `it('passes when spec has 0-8 file paths')` -- spec with 3 `src/` paths -> pass
- `it('warns when spec has 9-15 file paths')` -- spec with 10 paths -> warn
- `it('fails when spec has >15 file paths')` -- spec with 16 paths -> fail
- `it('deduplicates file paths')` -- spec mentioning same file 3 times -> counts as 1
- `it('does not check when spec is empty')` -- no `complexity` check

**Run:** `npx vitest run src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts`

---

## Feature 8: Spec Templates with Required Sections

### Problem
Current templates in `SpecEditor.tsx` are bare heading scaffolds with no guidance. Agents get empty sections and improvise poorly. The audit identified 5 template types that need structured content.

### Solution
Replace the 4 existing templates with 5 richer templates that include inline guidance comments and required sections. Add "Main Process" as a separate template from "Feature (Renderer)".

### Files to Change

1. **`src/renderer/src/components/task-workbench/SpecEditor.tsx`**
   - Replace `SPEC_TEMPLATES` with expanded templates:
     ```ts
     const SPEC_TEMPLATES: Record<string, { label: string; spec: string; specType: SpecType }> = {
       bugfix: {
         label: 'Bug Fix',
         specType: 'bugfix',
         spec: [
           '## Bug Description',
           '<!-- What is broken? Include error messages, screenshots, or reproduction steps -->',
           '',
           '## Root Cause',
           '<!-- Why does this happen? Which file/function/line is responsible? -->',
           '',
           '## Fix',
           '<!-- Exact changes: which functions to modify, what logic to add/remove -->',
           '',
           '## Files to Change',
           '<!-- List every file path. Include test files. -->',
           '- `src/...`',
           '',
           '## How to Test',
           '<!-- Steps to verify the fix. Include expected before/after behavior. -->',
           ''
         ].join('\n')
       },
       'feature-renderer': {
         label: 'Feature (UI)',
         specType: 'feature',
         spec: [
           '## Problem',
           '<!-- What user problem does this solve? -->',
           '',
           '## Solution',
           '<!-- Component names, props, state shape, user interactions -->',
           '',
           '## Files to Change',
           '<!-- TSX components, CSS files, store files, test files -->',
           '- `src/renderer/src/components/...`',
           '- `src/renderer/src/stores/...`',
           '',
           '## Out of Scope',
           '<!-- What should NOT be changed -->',
           '',
           '## How to Test',
           '<!-- Render scenarios, user interactions to verify -->',
           ''
         ].join('\n')
       },
       'feature-main': {
         label: 'Feature (Main)',
         specType: 'feature',
         spec: [
           '## Problem',
           '<!-- What capability is missing in the main process? -->',
           '',
           '## Solution',
           '<!-- IPC channels, handler logic, data flow -->',
           '',
           '## Files to Change',
           '<!-- Handler files, preload, shared types, test files -->',
           '- `src/main/handlers/...`',
           '- `src/preload/index.ts`',
           '- `src/preload/index.d.ts`',
           '- `src/shared/ipc-channels.ts`',
           '',
           '## Out of Scope',
           '',
           '## How to Test',
           '<!-- Integration test scenarios, IPC call/response expectations -->',
           ''
         ].join('\n')
       },
       refactor: {
         label: 'Refactor',
         specType: 'refactor',
         spec: [
           "## What's Being Refactored",
           '<!-- Current state: which module, why it needs refactoring -->',
           '',
           '## Target State',
           '<!-- Exact end state: new file structure, new function signatures, new patterns -->',
           '',
           '## Files to Change',
           '<!-- Every file that moves, splits, or gets modified -->',
           '- `src/...`',
           '',
           '## Out of Scope',
           '<!-- Explicitly: no behavioral changes, no new features -->',
           '',
           '## Verification',
           '<!-- All existing tests must still pass. No new behavior = no new tests needed. -->',
           ''
         ].join('\n')
       },
       test: {
         label: 'Test Coverage',
         specType: 'test',
         spec: [
           '## What to Test',
           '<!-- Which module/component needs test coverage? -->',
           '',
           '## Test Strategy',
           '<!-- Unit vs integration. Mock boundaries. Edge cases to cover. -->',
           '',
           '## Files to Create',
           '<!-- Test file paths -->',
           '- `src/.../__tests__/...test.ts`',
           '',
           '## Coverage Target',
           '<!-- Which branches/lines are currently uncovered? Target percentages. -->',
           ''
         ].join('\n')
       }
     }
     ```

2. **`src/shared/spec-validation.ts`** -- No changes needed. The `SpecType` union already covers all needed types.

### Tests

**File:** `src/renderer/src/components/task-workbench/__tests__/SpecEditor.test.tsx`

- `it('renders 5 template buttons')` -- verify 5 template buttons rendered (Bug Fix, Feature (UI), Feature (Main), Refactor, Test Coverage)
- `it('bugfix template includes How to Test section')` -- click Bug Fix, verify spec contains `## How to Test`
- `it('feature-main template includes preload files')` -- click Feature (Main), verify spec contains `preload/index.d.ts`
- `it('all templates include inline guidance comments')` -- each template contains `<!--`
- Update any existing tests that assert on the old template structure (4 templates -> 5)

**Run:** `npx vitest run src/renderer/src/components/task-workbench/__tests__/SpecEditor.test.tsx`

---

## Implementation Order

Execute in this order to maintain passing tests at each step:

1. **Feature 3** (Anti-Pattern Linting) -- pure function addition, no IPC, no side effects
2. **Feature 4** (Test Section Detection) -- pure function addition, same file
3. **Feature 5** (Handler Count Awareness) -- pure function addition, same file
4. **Feature 6** (Preload Sync Warning) -- pure function addition, same file
5. **Feature 7** (Complexity Estimation) -- pure function addition, same file
6. **Feature 8** (Spec Templates) -- renderer-only, no main process changes
7. **Feature 2** (File Existence Validation) -- requires new IPC handler + preload + channel registration
8. **Feature 1** (Wire Research to Copilot) -- renderer logic change, depends on existing IPC

---

## Pre-Commit Checklist

```bash
npm run typecheck   # Zero errors
npm test            # All tests pass
npm run lint        # Zero errors (warnings OK)
```

---

## Files Summary

| File | Action |
|------|--------|
| `src/renderer/src/hooks/useReadinessChecks.ts` | Add 5 new checks to `computeStructuralChecks()` |
| `src/renderer/src/hooks/__tests__/useReadinessChecks.test.ts` | Add ~20 new tests across 5 describe blocks |
| `src/renderer/src/components/task-workbench/SpecEditor.tsx` | Replace 4 templates with 5 richer templates |
| `src/renderer/src/components/task-workbench/__tests__/SpecEditor.test.tsx` | Update template count + content assertions |
| `src/renderer/src/components/task-workbench/WorkbenchCopilot.tsx` | Add research detection + `researchRepo` call |
| `src/renderer/src/components/task-workbench/__tests__/WorkbenchCopilot.test.tsx` | Add 5 research integration tests |
| `src/renderer/src/components/task-workbench/WorkbenchForm.tsx` | Wire `checkFiles` into semantic check flow |
| `src/renderer/src/components/task-workbench/__tests__/WorkbenchForm.test.tsx` | Add 2 file validation tests |
| `src/main/handlers/workbench.ts` | Add `workbench:checkFiles` handler |
| `src/main/handlers/__tests__/workbench.test.ts` | Update handler count (7->8), add 3 checkFiles tests |
| `src/preload/index.ts` | Add `checkFiles` to workbench namespace |
| `src/preload/index.d.ts` | Add `checkFiles` type declaration |
| `src/shared/ipc-channels.ts` | Add `'workbench:checkFiles'` channel |
