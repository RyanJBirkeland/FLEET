# Design: Split `prompt-composer.ts` by Agent Type

**Date:** 2026-04-13  
**Status:** Approved  
**Scope:** `src/main/agent-manager/prompt-composer.ts` and new sibling files

---

## Problem

`prompt-composer.ts` is 682 lines containing all five agent type builders, their exclusive constants, and shared section helpers in a single file. When modifying the pipeline agent prompt, a developer must load copilot and synthesizer logic into their head. When adding a new agent type, there is no clear boundary showing what belongs to that agent vs. what is shared.

---

## Goal

Split `prompt-composer.ts` by agent type into focused, independently readable files. Each file covers exactly one agent's assembly logic. Shared helpers live in one module. The public API (`buildAgentPrompt`) is unchanged.

---

## Architecture

### File Map

```
src/main/agent-manager/
├── prompt-composer.ts          ← dispatcher only (~55 lines, public API)
├── prompt-sections.ts          ← NEW: shared section builders and constants
├── prompt-pipeline.ts          ← NEW: pipeline agent builder + pipeline-only constants
├── prompt-assistant.ts         ← NEW: assistant + adhoc agent builder
├── prompt-copilot.ts           ← NEW: copilot agent builder
├── prompt-synthesizer.ts       ← NEW: synthesizer agent builder
└── prompt-composer-reviewer.ts ← existing, untouched
```

### Module Responsibilities

**`prompt-composer.ts`** (dispatcher, ~55 lines)
- Exports `BuildPromptInput`, `AgentType` (public contract types)
- Re-exports `classifyTask`, `TaskClass` for any callers that import them
- Contains `buildAgentPrompt(input)`: switch dispatch → length validation → log → return
- Retains `MIN_PROMPT_LENGTH` constant

**`prompt-sections.ts`** (shared builders, ~130 lines)
- Exports `CODING_AGENT_PREAMBLE`, `SPEC_DRAFTING_PREAMBLE`, `PLAYGROUND_INSTRUCTIONS`
- Exports `buildPersonalitySection(personality)`
- Exports `buildUpstreamContextSection(upstreamContext)`
- Exports `buildBranchAppendix(branch)`
- Exports `buildRetryContext(retryCount, previousNotes)`
- Exports `buildScratchpadSection(taskId)`
- Exports `truncateSpec(spec, maxChars)` utility
- Contains `Personality` interface (internal — used only within `prompt-sections.ts` and by agent-type modules that call `buildPersonalitySection`; not part of the public API)

**`prompt-pipeline.ts`** (pipeline agent, ~200 lines)
- Exports `buildPipelinePrompt(input: BuildPromptInput): string`
- Exports `classifyTask(taskContent): TaskClass` and `TaskClass` type
- Contains `TASK_CLASS_CAP`, `buildOutputCapHint(taskClass)`
- Contains all pipeline-only constants: `PIPELINE_SETUP_RULE`, `IDLE_TIMEOUT_WARNING`, `PIPELINE_JUDGMENT_RULES`, `DEFINITION_OF_DONE`, `CONTEXT_EFFICIENCY_HINT`
- Contains `buildTimeLimitSection(maxRuntimeMs)`

**`prompt-assistant.ts`** (assistant + adhoc, ~65 lines)
- Exports `buildAssistantPrompt(input: BuildPromptInput): string`
- Handles both `assistant` and `adhoc` agent types (same builder, different personality injected)

**`prompt-copilot.ts`** (copilot, ~75 lines)
- Exports `buildCopilotPrompt(input: BuildPromptInput): string`

**`prompt-synthesizer.ts`** (synthesizer, ~60 lines)
- Exports `buildSynthesizerPrompt(input: BuildPromptInput): string`
- Contains `SYNTHESIZER_SPEC_REQUIREMENTS` constant

---

## Data Flow

No behavior changes. The dispatch path is identical to today:

```
buildAgentPrompt(input)        ← callers unchanged
  → switch(input.agentType)
      pipeline    → buildPipelinePrompt(input)    [prompt-pipeline.ts]
      assistant   → buildAssistantPrompt(input)   [prompt-assistant.ts]
      adhoc       → buildAssistantPrompt(input)   [prompt-assistant.ts]
      copilot     → buildCopilotPrompt(input)     [prompt-copilot.ts]
      synthesizer → buildSynthesizerPrompt(input) [prompt-synthesizer.ts]
      reviewer    → buildReviewerPrompt(input)    [prompt-composer-reviewer.ts]
  → validate length (MIN_PROMPT_LENGTH)
  → log assembled length
  → return prompt
```

---

## Invariants

- `buildAgentPrompt` remains the sole public entry point — callers in `run-agent.ts` and workbench handlers do not change
- `BuildPromptInput` and `AgentType` stay in `prompt-composer.ts` (imported by all new files)
- `classifyTask` and `TaskClass` are re-exported from `prompt-composer.ts` for backward compat
- `prompt-composer-reviewer.ts` and its test file are untouched
- All new builder functions accept `BuildPromptInput` directly (no new intermediate types)

---

## Estimated Line Counts

| File | Lines |
|------|-------|
| `prompt-composer.ts` | ~55 |
| `prompt-sections.ts` | ~130 |
| `prompt-pipeline.ts` | ~200 |
| `prompt-assistant.ts` | ~65 |
| `prompt-copilot.ts` | ~75 |
| `prompt-synthesizer.ts` | ~60 |
| Total | ~585 (vs 682 today) |

---

## Testing

No new test files required. Existing behavior is preserved mechanically.

```bash
npm run typecheck   # must pass — zero type errors
npm test            # all unit tests must pass
npm run test:main   # main process tests must pass
npm run lint        # zero errors
```

If any test imports `classifyTask` or `TaskClass` directly from `prompt-composer.ts`, those imports continue to work via re-export.

---

## Commit Plan

Single commit after all files are in place and all checks pass:

```
chore: split prompt-composer.ts by agent type
```

One commit is preferred over five incremental ones here because intermediate states (e.g., builder extracted but dispatcher not yet updated) will fail typecheck. The diff is purely mechanical — no logic changes.
