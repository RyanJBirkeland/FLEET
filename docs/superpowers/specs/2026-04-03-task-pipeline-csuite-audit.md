# Task Pipeline C-Suite Audit — Unified Findings

**Date:** 2026-04-03
**Auditors:** Elena Vasquez (CPO), Marcus Chen (CTO), Priya Nair (CDO), James Okafor (VP Eng)
**Scope:** Full Task Pipeline feature — creation, execution, review, and completion lifecycle

---

## Executive Synthesis

Four independent audits converged on the same core finding: **the Task Pipeline's backend architecture is production-grade, but the user-facing experience fragments what should be a single workflow across three disconnected views.** The dependency system, watchdog infrastructure, and audit trail are best-in-class for a desktop orchestrator. But users can't access the dependency system from the creation UI, can't see agent progress from the pipeline view, and can't review code without switching views and losing context.

The system is architecturally sound but operationally opaque and experientially fragmented.

---

## Cross-Persona Agreement Matrix

These findings were independently identified by 2+ auditors:

| Finding                                | CPO | CTO | CDO | VP Eng | Priority          |
| -------------------------------------- | --- | --- | --- | ------ | ----------------- |
| Pipeline ↔ Code Review disconnect      | x   |     | x   |        | **P0**            |
| No dependency picker in creation UI    | x   |     |     |        | **P0**            |
| `sanitizeForGit` command injection bug |     | x   |     | x      | **P0 (security)** |
| Incomplete repository pattern coverage |     | x   |     |        | **P1**            |
| No agent progress in Pipeline view     | x   |     | x   |        | **P1**            |
| Nested interactive elements (a11y)     |     |     | x   |        | **P1**            |
| No main process coverage thresholds    |     |     |     | x      | **P1**            |
| `task_changes` table unbounded growth  |     | x   |     | x      | **P2**            |
| Dual logging systems                   |     |     |     | x      | **P2**            |
| No review notification/badge           | x   |     |     |        | **P2**            |
| No status transition state machine     |     | x   |     |        | **P2**            |
| Font size token entropy in CSS         |     |     | x   |        | **P3**            |
| No retry backoff for requeued tasks    |     |     |     | x      | **P3**            |

---

## Detailed Findings by Domain

### 1. Product & User Journey (Elena Vasquez, CPO)

**Overall Verdict:** Genuinely differentiated product with a complete autonomous dev loop. The three-tier readiness checks and dependency auto-resolution are competitive moats. But the fragmented view architecture (Workbench → Pipeline → Code Review) creates unnecessary cognitive switching for what is a single user journey.

**Critical Findings:**

- **P0 — Pipeline to Code Review disconnect.** When a task reaches `review` status, users see it in the Pipeline's review column but must manually navigate to Code Review (Cmd+5), find the task again, and click it. No cross-linking exists. Every single review requires this manual navigation.
  - Location: No `onReview` callback exists in `TaskDetailDrawer.tsx`; only `onViewLogs` navigates to Agents view.

- **P0 — No dependency picker in creation UI.** The backend supports hard/soft dependencies with cycle detection, but `WorkbenchForm.tsx:339-375` (Advanced section) only shows Priority and Playground toggle. The `dependsOn` field in `taskWorkbench.ts:35` is unused in the form. Users cannot access BDE's strongest backend feature through the UI.

- **P1 — No agent progress indication.** `TaskPill.tsx:148` shows a pulsing activity dot and elapsed timer, but zero information about what the agent is doing. The only way to see agent output is navigating to Agents view — a completely different panel.

- **P2 — Two-step task creation.** `WorkbenchForm.tsx:78-83` creates as `backlog` then immediately updates to `queued` — two round-trips for one user action.

- **P2 — No review notification badge.** Tasks silently enter `review` status. No badge on Code Review nav item, no OS notification, no persistent indicator.

**Strategic Product Risks:**

- **Review bottleneck at scale:** 5 concurrent agents can produce review tasks faster than a solo dev can review them. No batching, auto-merge for low-risk changes, or review prioritization exists.
- **Invisible dependency system:** If BDE's pitch includes multi-task orchestration, the UI must surface dependency management in the creation flow.

---

### 2. Architecture & Technical Excellence (Marcus Chen, CTO)

**Overall Verdict:** Well-structured system with clean process boundaries, dependency injection in the agent manager, and a centralized terminal-status convergence point (`TaskTerminalService`). The primary architectural risk is inconsistent data access layering — the repository pattern covers only 7 of 15+ query functions, and `sprint-local.ts` dual-imports raw queries alongside service-wrapped versions.

**Critical Findings:**

- **P0 (security) — `sanitizeForGit` is a no-op for command substitution.** `completion.ts:24-30` replaces `$(` with `$(` — identical strings. Task titles containing `$(command)` could be executed via git commit messages.

- **P1 — Repository pattern only covers agent-manager.** `sprint-task-repository.ts:7-9` explicitly notes this limitation. IPC handlers and Queue API import `sprint-queries` directly, creating two parallel data access paths. Behavioral changes (logging, caching, validation) must be applied in multiple places.

- **P1 — Dual import pattern in `sprint-local.ts`.** Lines 26-30 import raw `_getTask`/`_createTask`/`_updateTask`/`_deleteTask`; lines 31-44 import service-wrapped versions. Some handlers emit notifications, some don't. `sprint:unblockTask` (line 315) bypasses the service layer entirely.

- **P1 — `onStatusTerminal` wiring is fragile.** `sprint-local.ts:75` uses a mutable module-level callback set via `setOnStatusTerminal()`. If never called (a wiring bug), terminal transitions silently skip dependency resolution. The guard at line 172-175 logs but doesn't throw.

- **P2 — No status transition state machine.** `updateTask()` in `sprint-queries.ts:191-252` accepts any status value passing the allowlist check. No valid-transition enforcement exists at the data layer — it's scattered across `claimTask`, `sprint-local.ts`, and Queue API.

- **P2 — Dependency index rebuilt from scratch every drain cycle.** `index.ts:524-528` calls `repo.getTasksWithDependencies()` and `_depIndex.rebuild()` every poll. O(n) and currently cheap, but wasteful when the task graph hasn't changed.

- **P2 — `task_changes` table grows without bound.** `pruneOldChanges()` in `task-changes.ts:72-77` exists but is never called from production code.

**Scalability Assessment:**

- 100 tasks: comfortable
- 1,000 tasks: adequate with caveats (full task list returned on every poll)
- 10,000 tasks: bottleneck — `getTasksWithDependencies()` fetches ALL tasks every drain cycle, `listTasks()` returns entire corpus to renderer

---

### 3. Design & Information Architecture (Priya Nair, CDO)

**Overall Verdict:** Visually distinctive neon aesthetic with well-tokenized design system. The pipeline spatial metaphor works well. But the system suffers from fragmented mental models, growing CSS entropy, and several accessibility violations that need immediate attention.

**Critical Findings:**

- **P1 — Nested interactive elements (a11y violation).** `PipelineBacklog.tsx:32-59` wraps a `<button>` ("Add to queue") inside a `role="button"` container. This is invalid HTML/ARIA. Same pattern in failed cards at lines 68-99.

- **P1 — No landmark structure in Pipeline.** `SprintPipeline.tsx` renders as a generic `motion.div`. The three-zone layout has no `role="complementary"`, `role="main"`, or other landmarks. Screen reader users cannot orient.

- **P1 — Focus management missing for drawer/overlays.** When `TaskDetailDrawer` opens, focus doesn't move to it. When it closes, focus isn't returned to the triggering TaskPill. Overlay panels lack focus traps.

- **P2 — Font size entropy.** Despite `tokens.ts` defining a scale (xs=11px through xxl=20px), CSS files hardcode `10px` (23 occurrences), `11px` (8), `12px` (4) without token references. The most common small size (`10px`) has no corresponding token.

- **P2 — Border token inconsistency.** Pipeline uses `var(--bde-border)` for structural borders; Code Review uses `var(--neon-purple-border)` for identical purposes. Different visual results for same semantic role.

- **P2 — `pipeline-sidebar` has conflicting overflow.** `sprint-pipeline-neon.css:185-188` sets both `overflow-y: auto` and `overflow: hidden` — `overflow: hidden` wins, breaking scroll for backlog/failed tasks.

- **P2 — TaskPill information overload.** Up to 9 simultaneous visual elements in a 300px-wide pill: status dot, failure icon (4 variants), zombie/stale icons, title, repo badge, elapsed time, duration, activity indicator. Visual signals compete.

- **P3 — No keyboard navigation between task pills.** TaskPills have `tabIndex={0}` but no roving tab index or arrow-key navigation within stages. Keyboard users must Tab through every pill sequentially.

- **P3 — `!important` overrides.** `sprint-pipeline-neon.css:402,525-526` uses `!important` — specificity war symptom.

---

### 4. Operations & Platform Reliability (James Okafor, VP Eng)

**Overall Verdict:** Strong operational fundamentals — retry logic, fast-fail detection, orphan recovery, watchdog timers, and graceful shutdown are all present and correctly wired. Primary risks: no structured metrics, no alerting, and no main process test coverage enforcement.

**Critical Findings:**

- **P0 (security) — `sanitizeForGit` command injection** (corroborates CTO finding). `completion.ts:28` is a no-op replacement. Real injection vector since task titles come from Queue API/UI user input.

- **P1 — No main process coverage thresholds.** Renderer has enforced thresholds (72% stmts, 65% branches). The main process — where all critical orchestration lives — has none. Wrong priority inversion.

- **P1 — No structured metrics.** No instrumentation for drain loop duration, agent spawn latency, watchdog kill rate, retry frequency, or task throughput. Diagnosing performance degradation requires grepping log files.

- **P2 — Dual logging systems.** `createLogger` writes to `bde.log`; agent manager has its own `fileLog` writing to `agent-manager.log`. New engineers won't know which to use or where to look.

- **P2 — Only 1 generation of log rotation.** At 10MB cap with a single `.old` backup, a busy pipeline can lose diagnostic history within hours.

- **P2 — `changed_by` almost always `'unknown'`.** `sprint-queries.ts:236` defaults to `'unknown'`. Only `claimTask` and PR poller pass meaningful attribution. Reduces audit trail diagnostic value.

- **P3 — No retry backoff.** A systematically failing task is retried immediately on the next drain cycle. No exponential backoff or `next_eligible_at` cooldown prevents tight retry loops consuming agent slots.

- **P3 — Consecutive spawn timeout cascade.** Backpressure only applies to rate-limit-loop watchdog verdicts, not spawn timeouts. Fleet-wide API rate limits cause ALL queued tasks to cycle through spawn → timeout → error → requeue.

**Incident Preparedness:**

- **Can you diagnose a failed task at 2am?** Partially. Requires cross-referencing SQLite `agent_events`, `task.notes`, and `agent-manager.log` manually. No single correlated view exists.

---

## Prioritized Recommendations (Unified)

### Tier 1 — Immediate (security + workflow breaks)

| #   | Recommendation                                                                                               | Auditor(s)  | Effort   | Impact                        |
| --- | ------------------------------------------------------------------------------------------------------------ | ----------- | -------- | ----------------------------- |
| 1   | **Fix `sanitizeForGit` command injection** — replace no-op `$(` → `$(` with actual escaping or stripping     | CTO, VP Eng | 1 hour   | Critical (security)           |
| 2   | **Add "Review Changes" button to TaskDetailDrawer** — navigate to Code Review with task pre-selected         | CPO, CDO    | 1 day    | High (eliminates P0 friction) |
| 3   | **Build dependency picker in Workbench** — searchable task selector with hard/soft edge selection            | CPO         | 2-3 days | High (unlocks hidden feature) |
| 4   | **Fix nested interactive elements** in PipelineBacklog — restructure card/button nesting for a11y compliance | CDO         | 1 day    | High (a11y violation)         |

### Tier 2 — Near-term (architecture + observability)

| #   | Recommendation                                                                               | Auditor(s) | Effort   | Impact                           |
| --- | -------------------------------------------------------------------------------------------- | ---------- | -------- | -------------------------------- |
| 5   | **Extend `ISprintTaskRepository`** to cover all query functions — single data access path    | CTO        | 3-5 days | High (architectural hygiene)     |
| 6   | **Add main process coverage thresholds** — enforce ≥60% stmts/branches in CI                 | VP Eng     | 1 day    | High (testing confidence)        |
| 7   | **Add agent activity preview** to TaskDetailDrawer — 3-5 line live log tail for active tasks | CPO, CDO   | 3-4 days | High (observability)             |
| 8   | **Add status transition state machine** — enforce `VALID_TRANSITIONS` at data layer          | CTO        | 2 days   | Medium (prevents invalid states) |
| 9   | **Add review notification badge** on Code Review nav item                                    | CPO        | 1 day    | Medium (discoverability)         |
| 10  | **Add focus management** for drawer open/close and overlay focus traps                       | CDO        | 2 days   | Medium (a11y)                    |

### Tier 3 — Strategic (scale + polish)

| #   | Recommendation                                                                                        | Auditor(s)  | Effort   | Impact                          |
| --- | ----------------------------------------------------------------------------------------------------- | ----------- | -------- | ------------------------------- |
| 11  | **Implement structured metrics** — drain loop, spawn latency, watchdog kills, retries                 | VP Eng      | 3-5 days | Medium (operational visibility) |
| 12  | **Consolidate logging** — agent-manager uses `createLogger`, add correlation IDs, 3 generations       | VP Eng      | 2 days   | Medium (debuggability)          |
| 13  | **Schedule `pruneOldChanges()`** — wire into startup/periodic maintenance                             | CTO, VP Eng | 1 hour   | Low (prevents unbounded growth) |
| 14  | **Design token alignment pass** — replace hardcoded font sizes, standardize borders, add `10px` token | CDO         | 2-3 days | Low (design consistency)        |
| 15  | **Add keyboard navigation** — roving tab index in stages, j/k in review queue                         | CDO         | 2 days   | Low (power user experience)     |
| 16  | **Add retry backoff** — cooldown or `next_eligible_at` for requeued tasks                             | VP Eng      | 1-2 days | Low (prevents retry storms)     |

---

## Risk Register (Consolidated)

| Risk                                                   | Likelihood   | Impact   | Owner      | Mitigation                                |
| ------------------------------------------------------ | ------------ | -------- | ---------- | ----------------------------------------- |
| Command injection via task titles                      | Low          | Critical | CTO        | Fix `sanitizeForGit` (Tier 1, #1)         |
| `setOnStatusTerminal` wiring bug → blocked tasks stuck | Low          | Critical | CTO        | Add startup assertion                     |
| Review bottleneck at scale (5 agents > 1 reviewer)     | Medium       | High     | CPO        | Batch review, auto-merge for passing CI   |
| No alerting for autonomous failures                    | High         | Medium   | VP Eng     | Structured metrics + Dashboard warnings   |
| `task_changes` fills disk                              | Medium       | Medium   | CTO/VP Eng | Auto-prune on schedule (Tier 3, #13)      |
| Spawn timeout cascade under API rate limits            | Medium       | Medium   | VP Eng     | Cross-task timeout detection, drain pause |
| 10K+ tasks degrades poll/render performance            | Low (future) | High     | CTO        | Server-side pagination, delta changes     |

---

## Appendix: Individual Audit Reports

Full reports available from each auditor with file:line references:

- **CPO (Elena Vasquez):** User journey analysis, feature completeness, competitive moat, 7 friction points ranked
- **CTO (Marcus Chen):** Architecture assessment, scalability analysis (100/1K/10K), 10 technical debt items ranked, data layer deep-dive
- **CDO (Priya Nair):** Information architecture, cognitive load, 12 design debt items, accessibility audit with ARIA specifics
- **VP Eng (James Okafor):** Observability gaps, 6 failure mode scenarios, testing blind spots, 3 incident scenarios with expected vs actual behavior
