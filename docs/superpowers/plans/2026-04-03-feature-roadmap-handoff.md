# Feature Roadmap Handoff — Developer Persona Audit

> **For BDE Agent:** Create sprint tasks from these 6 plans. Each plan contains detailed TDD tasks with exact file paths, code, and test commands. Create one sprint task per plan, with the plan file as the spec.

## Context

A 4-persona developer audit produced 33 feature ideas, organized into 6 implementation plans. All plans and specs are committed to `feat/csuite-audit-fixes` branch.

## Spec & Plan Locations

### Audit Specs (read these for context)
- **C-Suite Audit (completed, merged):** `docs/superpowers/specs/2026-04-03-task-pipeline-csuite-audit.md`
- **Developer Persona Audit:** `docs/superpowers/specs/2026-04-03-developer-persona-audit.md`

### Implementation Plans (create tasks from these)

| # | Plan | File | Features | Est. Effort |
|---|------|------|----------|-------------|
| A | **Review Flow Overhaul** | `docs/superpowers/plans/2026-04-03-review-flow-overhaul.md` | Fix ConversationTab, Merge&Push, Batch review, Auto-review rules, AI review summary | 5 tasks |
| B | **Pipeline UX & Speed** | `docs/superpowers/plans/2026-04-03-pipeline-ux-speed.md` | Quick-create (Cmd+N), Desktop notifications, Pipeline keyboard shortcuts, Cost visibility, Saved views, Density toggle | 6 tasks |
| C | **Agent Intelligence** | `docs/superpowers/plans/2026-04-03-agent-intelligence.md` | Per-task model selection, Context propagation, Retry with context, Failure diagnostics, Cost budgets, Worktree checkpoint | 6 tasks |
| D | **Dependency & Orchestration** | `docs/superpowers/plans/2026-04-03-dependency-orchestration.md` | DAG visualization, Task chain templates, Batch import, Cascade cancel, Conditional deps | 5 tasks (9 sub-tasks) |
| E | **Power User & Extensibility** | `docs/superpowers/plans/2026-04-03-power-user-extensibility.md` | Command palette enhancement, Tags/labels, Morning briefing, Floating agent monitor, Query language, Settings profiles | 6 tasks (17 sub-tasks) |
| F | **Team & Collaboration** | `docs/superpowers/plans/2026-04-03-team-collaboration.md` | Reviewer assignment, Sprint planning, Webhooks, Plugin system foundation | 4 tasks |

## Recommended Execution Order

### Phase 1 — Foundation (do first, unblocks everything)
1. **Plan C, Task 1** (Per-task model + DB migration v24) — adds columns needed by other features
2. **Plan A, Task 1** (Fix ConversationTab) — most impactful UX fix, standalone

### Phase 2 — Quick Wins (independent, high impact)
3. **Plan B, Task 2** (Desktop notifications)
4. **Plan B, Task 3** (Pipeline keyboard shortcuts)
5. **Plan A, Task 2** (Merge & Push / Ship It)
6. **Plan B, Task 4** (Cost visibility per task)
7. **Plan E, Task 3** (Morning briefing)

### Phase 3 — Medium Complexity (independent)
8. **Plan B, Task 1** (Quick-create from Pipeline)
9. **Plan E, Tasks 1-3** (Command palette enhancement)
10. **Plan E, Tasks 4-8** (Tags/labels)
11. **Plan A, Task 3** (Batch review actions)
12. **Plan C, Tasks 2-3** (Context propagation + Retry with context)
13. **Plan D, Tasks 1-2** (Conditional deps)
14. **Plan D, Task 3** (Cascade cancel)

### Phase 4 — Complex Features
15. **Plan C, Tasks 4-6** (Failure diagnostics, Cost budgets, Worktree checkpoint)
16. **Plan D, Tasks 4-5** (DAG visualization)
17. **Plan B, Tasks 5-6** (Saved views, Density toggle)
18. **Plan A, Tasks 4-5** (Auto-review rules, AI review summary)
19. **Plan E, Tasks 9-11** (Query language)
20. **Plan D, Tasks 6-7** (Workflow templates, Batch import)

### Phase 5 — Team & Extensibility
21. **Plan F, Task 1** (Reviewer assignment)
22. **Plan F, Task 2** (Sprint planning)
23. **Plan F, Task 3** (Webhooks)
24. **Plan E, Tasks 14-16** (Settings profiles)
25. **Plan F, Task 4** (Plugin system foundation)

## Dependencies Between Plans

- **Plan C Task 1 must go first** — its migration (v24) adds columns (`model`, `retry_context`, `failure_reason`, `max_cost_usd`, `partial_diff`) used by Plans C, D, and E
- **Plans A, B, E** are fully independent of each other
- **Plan D Tasks 1-3** (conditional deps, cascade cancel) should precede Tasks 4-5 (DAG viz) and 6-7 (templates/import)
- **Plan F** is independent but lower priority (solo dev features first)

## Branch State

- **Branch:** `feat/csuite-audit-fixes`
- **Already merged to main:** 16 C-suite audit fixes (security, a11y, architecture, polish)
- **On branch, not yet merged:** 6 plan documents + audit specs

## How to Create Sprint Tasks

For each plan, create a sprint task with:
- **Title:** Plan name (e.g., "Review Flow Overhaul")
- **Repo:** `bde`
- **Spec:** The full plan file content (or reference to it)
- **Priority:** Phase 1 = P1, Phase 2 = P2, Phase 3 = P3, Phase 4-5 = P4

Or create individual tasks per sub-task within each plan for more granular tracking.
