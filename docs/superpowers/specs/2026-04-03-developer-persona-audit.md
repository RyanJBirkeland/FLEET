# Developer Persona Audit — Feature & Customization Wishlist

**Date:** 2026-04-03
**Auditors:** Sofia Reyes (Solo Dev), Daniel Park (Backend Eng), Aisha Okonkwo (Team Lead), Leo Marchetti (Power User)
**Scope:** Full Task Pipeline — features, UX, customization, and extension points

---

## Executive Synthesis

Four developer personas independently audited BDE and converged on a clear theme: **BDE's orchestration engine is production-grade, but it treats every user the same — there's no way to customize the workflow, no shortcuts for power users, and no collaboration primitives for teams.** The feature gap isn't in what BDE *does* (agent lifecycle, dependency resolution, code review) — it's in what BDE *doesn't let you control*.

The highest-signal findings across all personas:

1. **The review flow is the universal bottleneck** — every persona independently identified it
2. **ConversationTab is broken** — shows spec/notes, not the actual agent conversation
3. **No quick-create from Pipeline** — forces a view switch for the most common action
4. **No desktop notifications** — users miss completions entirely
5. **No keyboard shortcuts for actions** — only navigation has shortcuts
6. **No way to customize agent behavior per-task** — model, runtime, cost limits
7. **No dependency visualization** — the DAG is invisible despite being the backbone

---

## Cross-Persona Agreement Matrix

| Finding | Sofia | Daniel | Aisha | Leo | Category |
|---------|-------|--------|-------|-----|----------|
| ConversationTab shows spec not agent log | x | x | | x | **Bug/UX** |
| No quick-create from Pipeline view | x | | | x | **UX** |
| No desktop notifications | x | | x | x | **UX** |
| Review bottleneck (batch merge, one-click ship) | x | | x | x | **Workflow** |
| No dependency graph visualization | x | x | | x | **Feature** |
| No per-task model selection | | x | | x | **Feature** |
| No keyboard shortcuts for task/review actions | x | | | x | **UX** |
| No context propagation between dependent tasks | | x | | | **Architecture** |
| No retry with context (learn from failure) | x | x | | | **Feature** |
| No task tags/labels | | | x | x | **Feature** |
| No command palette task commands | | | | x | **UX** |
| No auto-review rules | | | x | x | **Feature** |
| No webhook/event push | | | x | x | **Integration** |
| No team identity/reviewer assignment | | | x | | **Collaboration** |
| No cost visibility per task | x | | | x | **UX** |

---

## Tier 1: Must-Have Features (unanimous or near-unanimous)

### 1. Fix ConversationTab — Show Agent Conversation
**Personas:** Sofia, Daniel, Leo
**Problem:** `ConversationTab.tsx` shows `task.spec` and `task.notes` — NOT the agent's tool calls, reasoning, and output. The name is misleading. Reviewers can't understand WHY the agent made its choices.
**Solution:** Load agent events from `agentEvents` store by `task.agent_run_id`. Render tool calls, text output, and errors in a chat-like format.
**Effort:** 1-2 days

### 2. Quick-Create from Pipeline View
**Personas:** Sofia, Leo
**Problem:** Creating a task requires switching to Task Workbench (Cmd+0), losing context of what you were looking at.
**Solution:** Cmd+N opens an inline creation bar at the top of any view. Title + Enter = backlog. Title + Cmd+Enter = queue with auto-generated spec. Slides away after creation.
**Effort:** 2-3 days

### 3. Desktop Notifications
**Personas:** Sofia, Aisha, Leo
**Problem:** Tasks complete silently. Users coding in other apps miss completions entirely. `useTaskToasts` only fires in-app toasts that disappear.
**Solution:** Use Electron's `Notification` API. Configurable per event type (completion, failure, review needed). Click-to-navigate.
**Effort:** 1-2 days

### 4. Merge & Push in One Click
**Personas:** Sofia, Leo
**Problem:** Review flow is 3+ steps: merge locally → switch to Source Control → push. For 5 overnight completions, this is 15 steps.
**Solution:** "Ship It" button (or dropdown: "Merge Locally" / "Merge & Push"). Single action merges + pushes + marks done.
**Effort:** 1 day

### 5. Per-Task Model Selection
**Personas:** Daniel, Leo
**Problem:** All tasks use the global `defaultModel`. Can't use haiku for simple fixes or opus for complex refactors.
**Solution:** Add `model` field to `SprintTask`. UI dropdown in WorkbenchForm advanced section. Pass through to `spawnAgent()`.
**Effort:** 1-2 days

### 6. Pipeline Keyboard Shortcuts
**Personas:** Sofia, Leo
**Problem:** Zero action shortcuts in Pipeline. Can navigate views (Cmd+1-7) but can't launch, stop, retry, or queue tasks without clicking.
**Solution:** Single-key shortcuts when a task is selected: `L` launch, `S` stop, `R` retry, `D` delete, `Q` queue, `E` edit, `V` view spec. Plus `J/K` for cross-stage navigation.
**Effort:** 1-2 days

### 7. Batch Review Actions
**Personas:** Sofia, Aisha, Leo
**Problem:** Reviewing 5+ tasks one-by-one is tedious. No multi-select, no bulk merge.
**Solution:** Checkboxes in ReviewQueue. "Merge All Selected (squash)" button. Confirmation shows aggregate diff stats.
**Effort:** 2-3 days

---

## Tier 2: Important Features

### 8. Dependency Graph Visualization
**Personas:** Sofia, Daniel, Leo
**Problem:** Dependencies are a flat list of IDs in the drawer. Can't see the DAG topology, critical path, or fan-out/fan-in patterns.
**Solution:** New overlay or panel rendering tasks as nodes and dependencies as arrows. Color by status. Click to navigate. Use `@dagrejs/dagre` for layout.
**Effort:** 3-5 days

### 9. Context Propagation Between Tasks
**Personas:** Daniel
**Problem:** When task B depends on task A, B's agent has ZERO knowledge of what A did. Each agent starts from scratch. For complex refactors where B must continue where A left off, users manually copy context.
**Solution:** In `prompt-composer.ts`, when a pipeline task has completed upstream deps, include their specs and `git diff --stat` in the prompt. Cap at 2000 tokens per upstream.
**Effort:** 2-3 days

### 10. Retry with Context
**Personas:** Sofia, Daniel
**Problem:** `sprint:retry` wipes the worktree and resets all context. The new agent starts from zero with no knowledge of what the previous attempt tried or why it failed.
**Solution:** Before cleanup, capture `git diff` and last agent events. Store in `retry_context` field. `buildAgentPrompt()` includes this when `retry_count > 0`: "Previous attempt produced this diff, then failed with: [error]."
**Effort:** 2-3 days

### 11. Task Tags / Labels
**Personas:** Aisha, Leo
**Problem:** Tasks are a flat list with no categorization beyond repo and priority. Can't group by feature area, type, or custom labels.
**Solution:** Add `tags TEXT` column (JSON array). Tag filter chips in PipelineFilterBar. Color-coded tag badges on TaskPill.
**Effort:** 2 days

### 12. Command Palette Enhancement
**Personas:** Leo
**Problem:** Command palette has ~19 commands (navigation + panel). No task commands, review commands, filter commands, or context-sensitive suggestions.
**Solution:** Expand to 50+ commands covering all actions. Views register commands dynamically. Recent commands section. Context-sensitive ranking.
**Effort:** 3-4 days

### 13. Cost Visibility Per Task
**Personas:** Sofia, Leo
**Problem:** Agent cost data exists (`costUsd`, `tokensIn`, `tokensOut`) but isn't shown on TaskPill, TaskDetailDrawer, or Code Review detail.
**Solution:** Show cost badge on completed TaskPills. Show cost breakdown in TaskDetailDrawer. Show aggregate cost in Dashboard "today" card.
**Effort:** 1-2 days

### 14. Structured Failure Diagnostics
**Personas:** Sofia, Daniel
**Problem:** Failed task notes are truncated to one line with ellipsis. Error classification is text-based (must parse strings). No suggested fixes.
**Solution:** Add `failure_reason` enum. Diagnostic panel in drawer showing error, last agent output, common causes, and action buttons (retry with longer timeout, retry with different model).
**Effort:** 2-3 days

### 15. Auto-Review Rules
**Personas:** Aisha, Leo
**Problem:** Low-risk changes (CSS-only, <10 lines, tests pass) clog the review queue. No automation.
**Solution:** Configurable rules engine: conditions (file patterns, line count, test status) → actions (auto-merge, auto-discard). Settings UI for rule builder.
**Effort:** 3-5 days

### 16. Saved Views / Filter Presets
**Personas:** Leo
**Problem:** Filter configuration resets on view change. Power users want "standup view", "triage view", "deep work view".
**Solution:** Save named presets (filter + sort + grouping). Access via command palette or PipelineFilterBar dropdown.
**Effort:** 1-2 days

---

## Tier 3: Nice-to-Have / Dream Features

### 17. Morning Briefing
**Personas:** Sofia
**What:** On app launch, show a dismissible card: "Since you last checked: 4 completed, 1 failed, 2 awaiting review. [Review All] [Dismiss]."

### 18. AI Review Summary
**Personas:** Sofia
**What:** Before human review, have a fast model scan the diff and write: "3 files changed, 2 new tests, no breaking changes, coverage likely increased by 2%."

### 19. Floating Agent Monitor
**Personas:** Sofia
**What:** Picture-in-picture widget showing active agent status from any view. Current tool/file, elapsed time, cost so far.

### 20. Task Chain Templates / Workflow Macros
**Personas:** Daniel, Leo
**What:** Define reusable task sequences with pre-wired dependencies: "audit → plan → implement → test → docs". One click creates the full chain.

### 21. Batch Task Import from YAML/JSON
**Personas:** Daniel, Leo
**What:** Import a 15-task dependency graph from a structured file. Define tasks + edges in a text editor, import in one click.

### 22. Plugin System
**Personas:** Leo
**What:** Lifecycle hooks (`onBeforeTaskCreate`, `onAgentComplete`, `onBeforeMerge`), UI extension points (dashboard widgets, drawer tabs, palette commands), plugin API for tasks/agents/settings.

### 23. Webhook/Event Push
**Personas:** Aisha, Leo
**What:** POST to configured URLs on task transitions, agent events, cost thresholds. Enables Slack notifications, GitHub Actions triggers, external dashboards.

### 24. Cross-Repo Contract Documents
**Personas:** Daniel
**What:** Shared context docs attached to task groups spanning repos. Agents in different repos receive the shared contract in their prompt.

### 25. Cascade Cancel on Hard-Dep Failure
**Personas:** Daniel
**What:** When a hard dependency fails, auto-cancel all downstream tasks in the chain. Configurable per-group.

### 26. Cost Budgets per Task
**Personas:** Leo
**What:** Set max cost (USD) per task. Agent auto-stops if budget exceeded. Watchdog checks `costUsd` alongside runtime.

### 27. Sprint Planning Module
**Personas:** Aisha
**What:** Sprint entity with date range and goal. Burn-down chart. Velocity tracking. Sprint retro dashboard.

### 28. Reviewer Assignment & Team Identity
**Personas:** Aisha
**What:** User model (from GitHub OAuth). `assigned_reviewer` field. "My Reviews" filter. Review lock to prevent concurrent merges.

### 29. Pipeline Density Toggle
**Personas:** Sofia
**What:** Switch between card view (current) and compact list/table view. Show more tasks in less space.

### 30. Task Search Query Language
**Personas:** Leo
**What:** `status:failed repo:bde priority:<=2 created:>7d tag:frontend "auth"` — structured query in PipelineFilterBar.

### 31. Settings Profiles
**Personas:** Leo
**What:** Named profiles ("solo dev" = 2 agents + opus, "sweep mode" = 5 agents + sonnet). Quick switch via command palette.

### 32. Conditional Dependencies
**Personas:** Daniel
**What:** `on_success` / `on_failure` / `always` conditions on dependency edges. Enables "if migration fails, run rollback" patterns.

### 33. Worktree Checkpoint / Partial Work Preservation
**Personas:** Daniel
**What:** Before cleaning up a failed agent's worktree, snapshot the diff. Show in Code Review even for failed tasks so users can salvage partial work.

---

## The Four Manifestos (Summarized)

### Sofia's "Solo Dev Mode"
- Default to prompt mode (no heading requirement for short tasks)
- One-click "Ship It" (merge + push + done)
- Cmd+N inline task creation from anywhere
- Desktop notifications with sound
- Auto-archive done tasks after 7 days
- Cost per task on every TaskPill

### Daniel's "10x Engineer Mode"
- DAG is the primary interface, not the flat pipeline
- Tasks have typed inputs/outputs — context flows downstream
- Failure is a first-class workflow (retry with context, cascade cancel, checkpoint)
- Cross-repo coordination is native (shared contracts, coordinated branches)
- Drain loop is topology-aware (critical path priority)

### Aisha's "Team Mode"
- User identity backed by GitHub OAuth
- Reviewer assignment with "My Reviews" filter
- Shared database (PostgreSQL or cr-sqlite)
- Sprint planning with burn-down and velocity
- CI gate before merge (run tests in worktree)
- Review comments and task discussions

### Leo's "Tinkerer's Paradise"
- Plugin API with lifecycle hooks and UI extension points
- Full-coverage scriptable API (every UI action available via HTTP)
- Dynamic command palette with 50+ commands
- User-remappable keyboard shortcuts
- Task query language with saved presets
- Per-task agent configuration (model, cost, runtime, permissions)

---

## Appendix: Complete Keyboard Shortcut Gap Analysis

See Leo Marchetti's audit Section 10 for a complete table of 30+ missing shortcuts with proposed bindings covering Pipeline, Code Review, Workbench, Dashboard, and Global actions.
