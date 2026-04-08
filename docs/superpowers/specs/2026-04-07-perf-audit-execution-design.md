# BDE Performance Audit — Execution Design

**Date:** 2026-04-07
**Status:** Approved for planning
**Owner:** Ryan
**Source audit:** `docs/superpowers/audits/2026-04-07/perf-audit/SYNTHESIS.md`
**Branch:** `chore/perf-audit-2026-04-07` at `~/worktrees/bde/perf-audit`

## Background

A 10-lens performance audit of BDE on 2026-04-07 produced 70 findings consolidated into a synthesis with a Top 10, 12 quick wins, and a deferred list. This spec turns the audit into an executable, phased workplan that can be paused and resumed across multiple sessions without losing context.

## Goal

Execute every audit finding that has positive ROI (52 of 70). Document the 14 explicitly deferred findings so future audits don't re-discover them. Phase the work so each phase produces working, shippable code and the workplan can resume cleanly across sessions.

## Non-Goals

- Re-running the audit. The findings are fixed inputs.
- Re-scoring findings. The synthesis ranking is treated as authoritative unless an open question changes the picture.
- Touching deferred findings. They are documented as out-of-scope with a reason.
- Optimizing for a single mega-PR. Phases land independently, one commit per finding.

## Approach

### Phase Structure

Six execution phases plus a Phase 0 research pass. Each phase produces working code, runs the full test suite, and commits before moving on. Phases are ordered by risk (lowest first) and dependency (Phase 0 unblocks Phases 1, 6).

#### Phase 0 — Resolve blocking open questions

**Type:** Research only. No code changes.
**Output:** `docs/superpowers/audits/2026-04-07/perf-audit/PHASE-0-ANSWERS.md`

Six findings escalate or collapse based on the answers. Resolve them before starting Phase 1.

| Question | Method | Affects |
|---|---|---|
| Q1: Are the 128 zero-input agent runs cache hits or silent failures? | Query `agent_runs WHERE tokens_in IS NULL OR tokens_in = 0` joined to `agent_events` to see if real work happened. | `F-t4-cost-4` |
| Q2: Why is `cost_events` empty after 31K agent events? | Grep `src/main/` for `cost_events` writers; check `db.ts` migration history. Decision: drop the table or implement the writer. | `F-t3-db-6`, `F-t3-model-3` |
| Q3: What is the actual `MAX_ACTIVE_TASKS` setting in production? | Read from snapshot `settings` table. | `F-t1-concur-1`, `-2`, `-3`, `-5` (severity adjustment) |
| Q5: Are pipeline `agent_events` ever read after task completion? | Grep `src/main/` and `src/renderer/` for `agent_events` SELECT queries; trace event-load callsites. | `F-t1-sre-1`, `F-t3-model-2` (retention strategy) |
| Q6: Is `sprint_tasks.max_cost_usd` ever read? | Grep for `max_cost_usd` references. | `F-t4-cost-5` (whether to enforce or drop the column) |
| Q4: Real SQLite write latency at single-agent baseline | Optional benchmark; if too expensive, skip and assume the audit's "High" rating. | `F-t1-concur-2` (lower priority) |

The Phase 0 doc records each question, the method used, the answer, and the impact on downstream phases. Findings that collapse to Low after Phase 0 move to the deferred list.

#### Phase 1 — Data Layer Quick Wins (7 findings)

**Risk:** Low. Pure DDL + small query rewrites in `src/main/data/` and `src/main/db.ts`.

| Finding | Title | File |
|---|---|---|
| `F-t3-db-1` | PR composite index `(pr_status, pr_number)` | `src/main/data/sprint-queries.ts:788-809` |
| `F-t3-db-3` | Composite `(status, claimed_by)` index | `src/main/db.ts` (new migration) |
| `F-t3-db-7` | `task_changes(task_id, changed_at DESC)` composite | `src/main/data/task-changes.ts:64-70` |
| `F-t3-db-6` / `F-t3-model-3` | `cost_events` decision (drop or wire) | depends on Phase 0 Q2 |
| `F-t3-model-1` | Skip unchanged-field writes in `recordTaskChanges` | `src/main/data/task-changes.ts:19-53` |
| `F-t3-db-2` | `listTasksRecent` OR-clause fix | `src/main/data/sprint-queries.ts` |
| `F-t3-db-4` | Batch loop-based audit inserts in `markTaskDoneByPrNumber` | `src/main/data/sprint-queries.ts` |

**Verification per finding:**
- For new indexes: `EXPLAIN QUERY PLAN` against the snapshot before and after, show `USING INDEX` line
- For `recordTaskChanges`: count `task_changes` row delta on a representative status loop
- For `listTasksRecent`: `EXPLAIN QUERY PLAN` shows index usage instead of `SCAN`

#### Phase 2 — Pipeline Hot Path (8 findings)

**Risk:** High. Touches the running drain loop and event mapper. Regression risk on agent throughput.

| Finding | Title | File |
|---|---|---|
| `F-t1-concur-6` | Reverse broadcast/write order in `emitAgentEvent` | `src/main/agent-event-mapper.ts:83-95` |
| `F-t1-concur-2` | Batch `agent_events` writes (50-event/100ms transactions) | `src/main/agent-event-mapper.ts` |
| `F-t1-sre-1` / `F-t3-model-2` | Cap `agent_events` retention (per-task pruning) | depends on Phase 0 Q5 |
| `F-t1-sysprof-1` / `F-t1-sysprof-4` | Cache `_depsEqual` comparison, kill sort thrash | `src/main/agent-manager/index.ts:608-625` |
| `F-t1-sysprof-2` | Defer `JSON.stringify` in event hot loop | `src/main/agent-event-mapper.ts` |
| `F-t1-concur-1` | Coalesce broadcast IPC fan-out per task terminal | `src/main/agent-manager/completion.ts` |
| `F-t1-concur-3` | Coalesce `resolveDependents` cascade | `src/main/agent-manager/resolve-dependents.ts` |
| `F-t1-concur-5` | PR poller + sprint-PR poller DB contention | `src/main/pr-poller.ts`, `src/main/sprint-pr-poller.ts` |

**Verification per finding:**
- For batching: count SQLite writes per agent run before/after, confirm count drops by ≥10×
- For sort thrash: add a counter on `_depsEqual` calls, confirm post-fix runs hit the fast path on unchanged ticks
- For broadcast coalescing: count IPC messages per task terminal before/after
- Run a synthetic 3-agent pipeline test after each commit

#### Phase 3 — SRE / Resource Hygiene (7 findings)

**Risk:** Low–Medium. Bounded-resource leaks; mostly mechanical fixes.

| Finding | Title | File |
|---|---|---|
| `F-t1-sre-2` | `setMaxListeners` on child stderr | `src/main/agent-manager/sdk-adapter.ts` (or wherever `child.spawn` happens) |
| `F-t1-sre-3` / `F-t1-concur-8` | Prune settled `_agentPromises` | `src/main/agent-manager/index.ts` |
| `F-t1-sre-4` | Simplify PR poller backoff timer | `src/main/pr-poller.ts` |
| `F-t1-sre-6` | TTL eviction on `_lastTaskDeps` | `src/main/agent-manager/dependency-index.ts` |
| `F-t1-sre-5` | Worktree disk reservation under concurrency | `src/main/agent-manager/worktree.ts` |
| `F-t1-sysprof-5` | OAuth token cache with TTL | `src/main/auth-guard.ts` or wherever `checkOAuthToken` lives |
| `F-t1-sysprof-3` | `getUserMemory` mtime cache | `src/main/agent-system/memory/index.ts` |

**Verification per finding:**
- For leak fixes: log the resource size at startup and after a 3-task simulated run, confirm no growth
- For caches: log cache hit/miss ratio over 10 calls

#### Phase 4 — Renderer Performance (7 findings)

**Risk:** Medium. UI regression risk; React behavior changes can be subtle.

| Finding | Title | File |
|---|---|---|
| `F-t2-react-1` | **SprintPipeline `useShallow` consolidation** ← Critical | `src/renderer/src/components/sprint/SprintPipeline.tsx:73-85` |
| `F-t2-react-3` | Decouple Dashboard `now` ticker | `src/renderer/src/views/DashboardView.tsx` |
| `F-t2-react-2` | `useDashboardMetrics` `now` dependency | `src/renderer/src/components/dashboard/` |
| `F-t2-react-4` | `useSprintPolling` `.some()` re-scan | `src/renderer/src/stores/sprintTasks.ts` or polling hook |
| `F-t2-react-5` | TaskRow callback identity | `src/renderer/src/components/sprint/PipelineStage.tsx` |
| `F-t2-react-6` | ActivitySection callback identity | `src/renderer/src/components/dashboard/ActivitySection.tsx` |
| `F-t2-react-7` | `useVisibilityAwareInterval` for inactive tasks | `src/renderer/src/components/sprint/TaskPill.tsx` |

**Verification per finding:**
- Add React DevTools render counters via `console.count` in dev mode, confirm post-fix render count drops on the relevant interaction
- Manual smoke: open Sprint Pipeline + Dashboard simultaneously, click around, confirm no visual regression
- Run `npm run test` for any updated component tests

#### Phase 5 — Bundle / Asset (6 findings)

**Risk:** Low–Medium. Build config changes can break dev/prod parity.

| Finding | Title | File |
|---|---|---|
| `F-t2-bundle-1` / `F-t2-bundle-6` | xterm + TerminalPane `React.lazy` + Suspense | `src/renderer/src/components/terminal/` |
| `F-t2-bundle-2` | Lazy view CSS imports | `src/renderer/src/main.css`, view-specific CSS files |
| `F-t2-bundle-3` | Monaco worker config | wherever Monaco is set up |
| `F-t2-bundle-4` | View preload on hover | view registry / panel system |
| `F-t2-bundle-5` | App.tsx top-level fan-out | `src/renderer/src/App.tsx` |
| `F-t2-bundle-8` | Confirm SDK marked external | `electron.vite.config.ts` |

**Verification per finding:**
- Run `npm run build` and inspect chunk sizes in `dist/`
- Manual cold-start test: kill app, relaunch, time to first render via timestamp logging
- Confirm IDE view still works (open file, edit, terminal)

#### Phase 6 — Token Economy (11 findings)

**Risk:** Medium. Prompt changes can subtly degrade agent behavior. Heavy regression testing.

| Finding | Title | File |
|---|---|---|
| `F-t4-ctx-1` / `F-t4-prompt-2` | Flip `isBdeRepo` default to false | `src/main/agent-system/memory/index.ts:17-25` |
| `F-t4-ctx-2` / `F-t4-prompt-4` | Lazy-inject skills (front-load index, defer details) | `src/main/agent-manager/prompt-composer.ts:265-268`, `src/main/agent-system/skills/index.ts` |
| `F-t4-prompt-3` | Trim copilot `SPEC_DRAFTING_PREAMBLE` | `src/main/agent-manager/prompt-composer.ts` |
| `F-t4-prompt-7` / `F-t4-ctx-3` | Cap `taskContent` at 2000 chars | `src/main/agent-manager/prompt-composer.ts` |
| `F-t4-ctx-5` | Cap copilot conversation history | wherever copilot history is composed |
| `F-t4-ctx-7` | Compress upstream context diffs | wherever upstream context is built |
| `F-t4-prompt-1` / `F-t4-ctx-10` | Decouple CLAUDE.md per agent type | `src/main/agent-manager/prompt-composer.ts` |
| `F-t4-cost-1` / `F-t4-cost-3` | Per-class output caps | spec generation + agent prompts |
| `F-t4-cost-5` | Enforce `max_cost_usd` | depends on Phase 0 Q6 |

**Verification per finding:**
- For each prompt change: run a sample task end-to-end and confirm token count drops as expected
- Spot-check 2-3 representative sample prompts before/after
- For output caps: verify the cap is honored without truncating useful content

### Phase 0 → Phase 6 Dependencies

```
Phase 0 (research)
  ├─ Q2 → Phase 1 (cost_events decision)
  ├─ Q3 → Phase 2 (severity adjustment)
  ├─ Q5 → Phase 2 (retention strategy)
  └─ Q6 → Phase 6 (max_cost_usd enforcement)

Phase 1 (data layer)
  └─ no downstream blockers

Phase 2 (pipeline) ← Phase 1 ideally done first (fewer DB writes makes Phase 2 easier to verify)
Phase 3 (SRE) ← Phase 2 ideally done first (drain loop changes settle)
Phase 4 (renderer) — independent of 1-3
Phase 5 (bundle) — independent of 1-4
Phase 6 (tokens) — independent of 1-5 (except Phase 0 Q6)
```

Phases 4, 5, 6 are independent of 1-3 and could be parallelized in theory, but the spec executes them sequentially to keep one session of work coherent and avoid cross-phase merge conflicts.

### Cross-Phase Conventions

- **Branch:** Continue on existing branch `chore/perf-audit-2026-04-07` at `~/worktrees/bde/perf-audit`. No new branches per phase.
- **Commit format:** One commit per finding. Message: `fix(perf): F-tX-name-N — <short title>`. Body explains the before/after and links the finding ID.
- **Pre-commit checks (per CLAUDE.md):** Every commit must pass `npm run typecheck && npm test && npm run lint`. Failing checks → fix or revert, never commit broken state.
- **TDD where it fits:** Pure logic changes (e.g. `_depsEqual`, dedup helpers, cap functions) get a failing test first. UI re-render fixes get a render counter assertion if practical, otherwise manual verification with a recorded check. DDL migrations get an `EXPLAIN QUERY PLAN` snapshot check.
- **Resumability:** This spec contains a `[ ] / [x]` checklist per finding (rendered in the implementation plan, not here). Any session can reload the spec, see what's done, and continue.
- **Phase boundary commits:** At the end of each phase, an empty commit (or doc commit) marks the boundary: `chore(perf): phase N complete — N findings landed`. This makes resumption obvious in `git log`.
- **Verification artifacts:** Where a finding has a measurable before/after (query plan, render count, bundle size), capture both in the commit message body.

## Deferred Findings (14)

Ported verbatim from `SYNTHESIS.md` §4. Each is documented with a reason so future audits don't re-discover them as "missed work."

| ID | Reason for deferral |
|---|---|
| `F-t2-react-8` | Score 0.75 — premature for 525-row dataset; revisit at 5K+ tasks |
| `F-t4-prompt-5` / `F-t4-ctx-6` | Score 1.0 — ~$0.01/mo savings, defer to docs reorg |
| `F-t4-prompt-6` | Score 1.0 — ~$0.18/mo, personality consolidation is style not perf |
| `F-t4-prompt-8` | Score 1.0 — diff cap audit blocked on usage telemetry |
| `F-t4-prompt-9` | Score 0.5 — naming clarity, no perf impact |
| `F-t4-prompt-10` | Score 1.0 — UX nit |
| `F-t2-bundle-9` | Score 0.25 — CSS Modules migration (L) too speculative |
| `F-t2-bundle-7` | Score 1.0 — verify-only task, low payoff |
| `F-t3-model-5` | Score 1.0 — speculative; no observed missed events |
| `F-t1-sre-6` | Score 0.67 — trivial leak, low absolute size *(NOTE: this is also in Phase 3 — leave one canonical, drop the deferred entry)* |
| `F-t1-concur-7` | Score 0.5 — duplicate of `F-t1-sysprof-1` / `F-t1-sysprof-4` (folded into Phase 2) |
| `F-t1-concur-8` | Score 1.0 — only matters after 200+ hours uptime *(NOTE: also in Phase 3 — leave one canonical)* |
| `F-t1-sysprof-6` | Score 0.5 — retry-only optimization, low frequency |
| `F-t3-model-4` | Score 0.5 — `depends_on` relational migration is L effort, only 106 rows; revisit when graph depth grows |

The two NOTE entries above are dedup conflicts between the synthesis's Quick Wins table and Deferred table. The spec resolves them by keeping the Phase 3 entries and dropping the deferred duplicates, since "fix it cheap" wins over "defer." Net deferred count: 12 distinct findings.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Phase 2 (pipeline) regression breaks running agents in production | Run a synthetic 3-agent pipeline test after each Phase 2 commit. Revert immediately on failure. |
| Phase 6 prompt changes degrade agent task success rate | Spot-check prompts before/after with a sample task. If the fix saves tokens but the agent fails the task, revert. |
| Session ends mid-phase | The per-finding checklist + per-phase boundary commits make resumption obvious. The next session reads this spec, scans `git log` for the last `chore(perf): phase N complete` marker, and resumes from there. |
| A Phase 0 answer invalidates a downstream finding | The Phase 0 doc records the rationale. Affected findings move to the deferred list with the new reason. |
| Cumulative test runtime grows and slows iteration | Each commit runs the full suite. If runtime becomes painful, opt into `npm run test` (skip coverage) per-commit and run `npm run test:coverage` at phase boundaries only. |
| Merge conflicts with `main` if the audit branch lives long | Phases 4, 5 touch frequently-edited files (`App.tsx`, build config). Rebase onto `main` at each phase boundary. |

## Success Criteria

- 52 of 70 findings landed as commits on `chore/perf-audit-2026-04-07`, each with a passing test suite at the time of commit.
- 12 deferred findings documented in this spec with reasons.
- Phase 0 doc exists at `docs/superpowers/audits/2026-04-07/perf-audit/PHASE-0-ANSWERS.md`.
- Six `chore(perf): phase N complete` boundary commits in `git log`.
- A measurable improvement in at least one of: agent throughput at `MAX_ACTIVE_TASKS=3`, Pipeline view render frequency, cold-start time to first render, or average input tokens per pipeline task. *(Measurements captured in the boundary commits where applicable.)*
- The branch is mergeable to `main` with no broken tests.

## Out of Scope

- Re-running the audit or adding new findings.
- Refactoring beyond what each finding's recommendation requires.
- Improving UI design / UX beyond performance characteristics.
- Updating dependencies (unless a dep update is the recommended fix).
- E2E benchmarks beyond the per-phase verification described above.

## Next Step

Invoke `superpowers:writing-plans` to turn each phase into a checklist of bite-sized implementation tasks with exact commands, expected outputs, and per-finding TDD steps where applicable. The plan is what an executor (subagent or this session) will work from task by task.
