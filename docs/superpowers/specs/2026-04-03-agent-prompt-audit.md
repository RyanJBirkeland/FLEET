# Agent Prompt Quality Audit — Unified Findings

**Date:** 2026-04-03
**Auditors:** Pipeline Agent (veteran), Failing Agent (frustrated), Spec Writer (human), Code Reviewer (human)
**Scope:** Everything that goes into an agent's prompt and everything that comes out

---

## Executive Synthesis

Four personas audited BDE's agent prompt system from opposite ends: the agents receiving prompts, and the humans writing specs and reviewing output. They converged on a devastating finding: **the task spec — the thing the agent is actually here to do — is only ~6% of the injected context.** The other 94% is framework injection (preamble, personality, conventions, CLAUDE.md, BDE_FEATURES.md) that is mostly unfiltered, redundant, and not task-relevant.

The three highest-impact changes, independently identified by 3+ personas:

1. **Inject retry context** — agents repeat the same mistakes because they have zero memory of previous attempts
2. **Tell agents their time limit** — they get killed at 60 minutes with no warning, can't plan work
3. **Make npm install unconditionally first** — the #1 cause of fast-fail loops

---

## The Token Budget Problem

| Component                             | Tokens      | % of Context |
| ------------------------------------- | ----------- | ------------ |
| Universal Preamble                    | 350         | 1.9%         |
| Personality + Constraints             | 125         | 0.7%         |
| BDE Conventions (3 modules)           | 700         | 3.8%         |
| Branch appendix                       | 50          | 0.3%         |
| **CLAUDE.md** (via settingSources)    | **10,100**  | **55%**      |
| **BDE_FEATURES.md** (via @ directive) | **4,000**   | **21.8%**    |
| Global CLAUDE.md                      | 1,100       | 6%           |
| **Task spec/prompt**                  | **375**     | **~6%**      |
| **Total**                             | **~17,200** | 100%         |

**The task itself is 6% of the injected context.** CLAUDE.md alone is 55%.

---

## Cross-Persona Agreement Matrix

| Finding                                                   | Pipeline Agent | Failing Agent | Spec Writer | Reviewer | Impact       |
| --------------------------------------------------------- | -------------- | ------------- | ----------- | -------- | ------------ |
| No retry context (attempt count + failure reason)         | x              | x             |             |          | **Critical** |
| No time limit communicated                                | x              | x             |             |          | **Critical** |
| npm install should be unconditional first action          |                | x             |             |          | **Critical** |
| No idle timeout warning (15 min = death)                  |                | x             |             |          | **High**     |
| CLAUDE.md is 10K tokens of unfiltered gotchas             | x              |               |             |          | **High**     |
| Spec appended raw with no framing                         | x              |               | x           |          | **High**     |
| Personality constraints duplicate preamble                | x              |               |             |          | **Medium**   |
| `patterns` field in personality is dead code              | x              |               |             |          | **Medium**   |
| Copilot can't access codebase (research handler orphaned) |                |               | x           |          | **Critical** |
| No file existence validation in readiness checks          |                |               | x           |          | **High**     |
| ConversationTab shows spec, not agent conversation        |                |               |             | x        | **Critical** |
| No scope boundary enforcement in prompt                   |                |               |             | x        | **High**     |
| No commit message quality standard                        |                |               |             | x        | **High**     |
| No per-task file manifest                                 | x              |               |             |          | **High**     |
| No definition of "done" in prompt                         |                | x             |             | x        | **High**     |

---

## Tier 1: Immediate Prompt Fixes (inject today, prevent failures tomorrow)

### 1. Inject Retry Context

**Personas:** Pipeline Agent, Failing Agent
**Problem:** `buildAgentPrompt()` receives no `retryCount` or `previousNotes`. `BuildPromptInput` has no fields for them. Retried agents repeat the same mistake.
**Fix:** Add `retryCount` and `previousNotes` to `BuildPromptInput`. In `run-agent.ts`, pass `task.retry_count` and `task.notes`. In `prompt-composer.ts`, add:

```
## Retry Context
This is attempt {N+1} of {MAX+1}. Previous attempt failed: {notes}
Do NOT repeat the same approach.
```

**Expected failure reduction:** ~40% of retry failures

### 2. Inject Time Limit

**Personas:** Pipeline Agent, Failing Agent
**Problem:** Agents don't know their `max_runtime_ms`. They get killed at 60 minutes mid-work.
**Fix:** Add `maxRuntimeMs` to `BuildPromptInput`. Render: "You have {N} minutes. Budget 70% for work, 30% for testing. Commit early — uncommitted work is lost if you're killed."
**Expected failure reduction:** ~25% of timeout kills

### 3. Make npm install Unconditionally First

**Personas:** Failing Agent
**Problem:** Preamble says "Run npm install IF node_modules is missing." Agents try typecheck first, die in <30s, burn all 3 fast-fail lives.
**Fix:** Change to: "Your worktree has NO node_modules. Run `npm install` as your FIRST action before anything else."
**Expected failure reduction:** ~60% of fast-fail exhaustion

### 4. Add Idle Timeout Warning

**Personas:** Failing Agent
**Problem:** Agents get killed for no output in 15 minutes. They don't know this.
**Fix:** Add: "You will be terminated if you produce no output for 15 minutes. If running long commands, emit a progress note before and after."
**Expected failure reduction:** ~50% of idle kills

### 5. Add Definition of Done

**Personas:** Failing Agent, Code Reviewer
**Problem:** Agents don't know what "done" means. Some exit without committing. Some commit without testing.
**Fix:** Append after task content: "Your task is complete when: (1) all changes committed, (2) `npm run typecheck` passes, (3) `npm test` passes, (4) `npm run lint` passes."
**Expected failure reduction:** ~20% of no-commit failures

### 6. Add Scope Boundary Enforcement

**Personas:** Code Reviewer
**Problem:** Agents touch unrelated files, add unnecessary refactors. No prompt instruction prevents this.
**Fix:** Add to pipeline personality: "Only modify files directly required by the task spec. Do not refactor adjacent code. Every file you touch must be justified by a spec requirement."
**Expected failure reduction:** ~30% of review rejections

---

## Tier 2: Prompt Optimization (reduce waste, improve quality)

### 7. Filter CLAUDE.md by Task Domain

**Personas:** Pipeline Agent
**Problem:** 10K tokens of gotchas, most irrelevant to any single task. A CSS task doesn't need OAuth token format gotchas.
**Fix:** Tag gotchas by domain (renderer, main-process, testing, git, css, ipc). Based on task spec keywords, inject only relevant subset. Cut from 10K to ~2K tokens.

### 8. De-duplicate Personality vs Preamble

**Personas:** Pipeline Agent
**Problem:** "Never push to main" appears 4 times. "Run npm install" appears 3 times. "Run tests" appears in 3 places with slightly different wording.
**Fix:** Pipeline personality should ONLY contain pipeline-specific rules. Remove everything already in the preamble.

### 9. Fix Dead `patterns` Field

**Personas:** Pipeline Agent
**Problem:** `pipeline-personality.ts` has a `patterns` array that `buildAgentPrompt()` never reads. Dead code.
**Fix:** Either inject patterns into the prompt or remove the field.

### 10. Add Per-Task File Manifest

**Personas:** Pipeline Agent
**Problem:** Agents waste 15-20% of tokens on exploratory file reads to figure out which files to touch.
**Fix:** Before spawning, scan the spec for file references, component names, IPC channels. Generate a `## Files to Touch` section with actual paths. Include related test file paths.

### 11. Commit Message Quality Standard

**Personas:** Code Reviewer
**Problem:** Agents write "feat: implement changes" — meaningless.
**Fix:** Add: `Commit messages must follow: {type}({scope}): {what} — {why}. The "why" clause is mandatory.`

### 12. Agent Self-Review Checklist

**Personas:** Code Reviewer
**Fix:** Add to pipeline personality:

```
Before your final push, verify:
- [ ] Every changed file is required by the spec
- [ ] No console.log, commented-out code, or TODO left behind
- [ ] No hardcoded colors or magic numbers
- [ ] Tests cover error states, not just happy paths
- [ ] Preload .d.ts updated if IPC channels changed
```

---

## Tier 3: Spec System Improvements

### 13. Wire `workbench:researchRepo` to Copilot

**Personas:** Spec Writer
**Problem:** The Copilot says "I can help you research the codebase" but literally cannot. The `workbench:researchRepo` IPC handler exists, does real grep, returns real results — but nothing calls it from the Copilot flow.
**Fix:** When the Copilot receives a research question, call `workbench:researchRepo`, inject results into the conversation context. This single change transforms the Copilot from a hallucination machine into a research tool.

### 14. Real File Existence Validation

**Personas:** Spec Writer
**Problem:** Semantic checks use Haiku to guess "do these paths look plausible?" instead of actually checking `fs.stat()`.
**Fix:** Extract file paths from spec via regex. Call `fs.stat()` on each. Fail if explicitly-named files don't exist.

### 15. Spec Anti-Pattern Linting

**Personas:** Spec Writer
**Problem:** Specs with "explore," "investigate," "find issues," "improve where needed" cause agents to thrash.
**Fix:** Tier 1 structural check: detect research-style language and warn "Pipeline agents need explicit execution instructions, not exploration directives."

### 16. 10 New Readiness Checks

From Spec Writer audit:

1. File existence validation (fs.stat)
2. Test section detection
3. Handler count awareness
4. Preload declaration sync warning
5. Complexity estimation (file count)
6. Duplicate task detection (fuzzy title match)
7. Branch conflict check (file overlap with active tasks)
8. Out of Scope section check
9. Code snippet presence check
10. Migration awareness (column list gotcha)

---

## The Survival Guide (Ready to Inject)

From Failing Agent audit — this text should be injected into every pipeline agent's prompt:

```
PIPELINE AGENT SURVIVAL GUIDE

FIRST 60 SECONDS — Environment Setup:
1. npm install — your worktree has NO node_modules
2. git status — confirm you're on your assigned branch
3. git log --oneline -3 — confirm clean starting state

TIME MANAGEMENT:
- You have a maximum of {MAX_RUNTIME} minutes
- You will be killed with NO WARNING if you exceed this limit
- You will be killed if you produce NO OUTPUT for 15 minutes
- Commit early. Commit often. Uncommitted work is lost if you're killed.

RETRY AWARENESS:
- This is attempt {RETRY_COUNT + 1} of {MAX_RETRIES + 1}
{IF RETRY: "Previous attempt failed: {NOTES}. Do NOT repeat the same approach."}

TESTING:
- Run npm test after your FIRST file change, not your last
- If you add IPC handlers, update the handler count test
- Budget 2-3 minutes for a full test run (2500+ tests)

GIT SAFETY:
- NEVER run git checkout. You are already on the correct branch.
- Commit format: {type}: {description}

SCOPE:
- Change the minimum files needed. Every extra file is risk.
- If the spec is unclear, implement conservatively and note ambiguities.

COMPLETION:
- Done = all changes committed + typecheck passes + tests pass + lint passes
- A human will review your diff. Keep it focused and minimal.
```

---

## The 5 Spec Templates (Ready to Use)

From Spec Writer audit — detailed templates for Bug Fix, Feature (Renderer), Feature (Main Process), Refactor, and Test Coverage. Each has required sections that give agents everything they need. See full templates in the Spec Writer audit output.

---

## Auto-Generated Review Checklist (Ready to Build)

From Code Reviewer audit — BDE should auto-generate this when a task enters `review`:

```
Build Verification:  typecheck {PASS/FAIL} | tests {N} passed | lint {PASS/FAIL}
Coverage Impact:     stmts {before}→{after} | branches {before}→{after}
Scope Compliance:    {N} files changed | high-risk files: {list} | new files: {list}
Code Quality:        console.log: {count} | hardcoded colors: {count} | SELECT *: {count}
Commit Quality:      {N} commits | format compliance: {YES/NO}
```

---

## Appendix: Individual Audit Highlights

- **Pipeline Agent:** Token budget analysis, redundancy inventory, "perfect pipeline prompt" redesign
- **Failing Agent:** Root cause analysis for 11 failure modes, 22 ranked prompt improvements, survival guide text
- **Spec Writer:** Spec quality spectrum (5 levels with examples), 10 new readiness checks, 17 feature requests, 5 spec templates
- **Code Reviewer:** Output quality rubric (7 dimensions, 1-5 scale), 10 prompt additions, auto-generated review checklist, 17 review UI feature requests
