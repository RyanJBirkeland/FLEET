# CLAUDE.md — BDE

@../../ARCHITECTURE.md
@docs/BDE_FEATURES.md

Electron desktop app (electron-vite + React + TypeScript) — the Birkeland Development Environment.

## Build & Test

```bash
npm install          # Install dependencies
npm run dev          # Dev server with HMR
npm run build        # Type-check + production build (must pass before PR)
npm run typecheck    # TypeScript type checking (also runs in CI)
npm test             # Unit tests via vitest (must pass before PR)
npm run test:main    # Main process tests (separate vitest config)
npm run test:coverage # Unit tests + coverage threshold enforcement (used in CI)
npm run test:e2e     # E2E tests via Playwright (requires built app)
npm run lint         # ESLint
npm run format       # Prettier
```

## CI

GitHub Actions runs on every push to `main` and every PR targeting `main`:

- `npm run lint` — must pass
- `npm run typecheck` — must pass
- `npm run test:coverage` — must pass (enforces coverage thresholds: 73% stmts, 65% branches, 73% functions, 74% lines)
- `npm run test:main` — must pass (main process integration tests)

All checks are required before merge.

**MANDATORY: Before EVERY commit, run ALL of these:**

```bash
npm run typecheck   # Zero errors required
npm test            # All tests must pass
npm run lint        # Zero errors required (warnings OK)
```

Do NOT commit with failing checks. Fix issues first. If you cannot fix a failure, do NOT commit — report the issue.

## Branch Conventions

- `feat/` — New features (e.g. `feat/git-client`)
- `fix/` — Bug fixes (e.g. `fix/rpc-layer`)
- `chore/` — Maintenance, docs, refactors (e.g. `chore/audit`)

## Commit Messages

Format: `{type}: {description}`

- `feat:` new feature
- `fix:` bug fix
- `chore:` maintenance / docs

## Key File Locations

- Task terminal resolution service: `src/main/services/task-terminal-service.ts` (unified `onStatusTerminal` — all terminal paths converge here)
- Sprint task dependency management: `src/main/handlers/sprint-local.ts` (auto-blocking on create/transition)
- Dependency resolution after completion: `src/main/agent-manager/resolve-dependents.ts`
- Shared sanitization: `src/shared/sanitize-depends-on.ts`
- Agent auto-commit: `src/main/agent-manager/completion.ts` (uses `git add -A` to capture new files; `.gitignore` excludes node_modules etc.)
- Agent event mapping/emission: `src/main/agent-event-mapper.ts` (shared by adhoc + pipeline agents)
- Worktree management: `src/main/agent-manager/worktree.ts`
- Shutdown/lifecycle: `src/main/agent-manager/index.ts`
- Repository interface: `src/main/data/sprint-task-repository.ts` (ISprintTaskRepository + factory)
- Audit trail: `src/main/data/task-changes.ts` (field-level change tracking in SQLite)
- Shared logger: `src/main/logger.ts` (createLogger → `~/.bde/bde.log`)
- Polling hook: `src/renderer/src/hooks/useBackoffInterval.ts` (backoff + jitter)
- Prompt composer: `src/main/agent-manager/prompt-composer.ts` — `buildAgentPrompt()` builds prompts for all agent types (pipeline, assistant, adhoc, copilot, synthesizer). All spawn paths must use this instead of inline prompt assembly.
- Shared SDK streaming: `src/main/sdk-streaming.ts` — extracted `runSdkStreaming()` utility used by workbench and synthesizer. Don't duplicate this inline.
- Roving tab index hook: `src/renderer/src/hooks/useRovingTabIndex.ts` — shared keyboard tab navigation (arrow keys, Home/End)
- Diff file selection hook: `src/renderer/src/hooks/useDiffSelection.ts` — diff file selection state management
- IDE keyboard hook: `src/renderer/src/hooks/useIDEKeyboard.ts` — extracted IDE keyboard shortcuts
- Pipeline sub-components: `src/renderer/src/components/sprint/PipelineHeader.tsx`, `PipelineOverlays.tsx`, `TaskDetailActionButtons.tsx` — extracted from SprintPipeline/TaskDetailDrawer
- Collapsible block: `src/renderer/src/components/agents/CollapsibleBlock.tsx` — shared collapsible pattern for agent console
- Diff components: `src/renderer/src/components/diff/PlainDiffContent.tsx` (non-virtualized diff), `DiffFileList.tsx` (diff file sidebar)
- Format utilities: `src/renderer/src/lib/format.ts` — `formatDuration()` and `formatDurationMs()` consolidated here
- Textarea prompt modal: `src/renderer/src/components/ui/TextareaPromptModal.tsx` — multi-line input modal (used by Code Review revision requests)
- ADR — store separation: `docs/architecture-decisions/costdata-agenthistory-separation.md`

## PR Rules

1. Branch from `main`, PR back to `main` — no direct pushes to `main`
2. **Self-heal**: `npm run build` and `npm test` must both pass before opening a PR
3. Keep PRs focused — one feature or fix per PR
4. **UX PRs must include screenshots or ASCII art** of every changed UI surface in the PR body. Use ASCII art as fallback if the app can't be rendered. This is required — no exceptions.

## Dependency Policy

- **No new npm packages without explicit approval.** Evaluate whether the functionality can be achieved with existing dependencies or standard Node.js APIs before proposing a new package.
- When a new dependency is justified, prefer packages that are: small, well-maintained, tree-shakeable, and have no transitive dependencies.

## Code Quality

- **Clean Code principles**: functions do one thing, meaningful names, no magic numbers, small files.
- **Clean Architecture**: respect process boundaries (main/preload/renderer), keep IPC surface minimal, shared types in `src/shared/`.
- All IPC handlers must use the `safeHandle()` wrapper for error logging.
- Prefer `execFile`/`execFileAsync` (argument arrays) over `execSync` (string interpolation) to prevent shell injection.

## Conflict-Prone Files

These files are edited frequently across branches. Take extra care when modifying:

- `src/renderer/src/App.tsx` — main app shell, keyboard shortcuts, view routing
- `src/main/index.ts` — all IPC handler registrations
- `src/preload/index.ts` — preload bridge API surface

## Architecture Notes

- **Data layer**: SQLite at `~/.bde/bde.db` (WAL mode, schema in `src/main/db.ts`). Backup via `VACUUM INTO` to `bde.db.backup` runs on startup + every 24h. for all local tables: `agent_runs`, `settings`, `cost_events`, `agent_events`, `task_changes`, `sprint_tasks`. Sprint tasks live in local SQLite (migration v15 recreated the table) — accessed via `src/main/data/sprint-queries.ts`. On first launch, `importSprintTasksFromSupabase()` runs as a one-time fire-and-forget migration if credentials are present; it is a no-op once the table has rows. Audit trail stored in `task_changes` table (migration v14) — field-level diffs logged on every `updateTask()` call.
- **Repository pattern**: `src/main/data/sprint-task-repository.ts` defines `ISprintTaskRepository` interface. Agent manager receives the repository via constructor injection (`createAgentManager(config, repo, logger)`). Concrete implementation delegates to sprint-queries. IPC handlers (sprint-local.ts) import sprint-queries directly — they're thin enough not to need the abstraction.
- **AgentManager**: `src/main/agent-manager/` — in-process task orchestration. Drain loop watches for queued tasks, spawns agents in git worktrees via SDK, monitors with watchdogs, handles completion (transition to `review` status, preserve worktree, retry logic). All data access goes through `ISprintTaskRepository` (injected). Core agent lifecycle in `run-agent.ts` with explicit `RunAgentDeps` interface. Per-task `max_runtime_ms` overrides the global 1-hour watchdog limit.
- **AuthGuard**: `src/main/auth-guard.ts` — validates Claude Code subscription token. NOT called in the drain loop (Keychain access hangs in Electron). Auth is validated by the SDK at spawn time instead. Users must run `claude login` to authenticate.
- **Task dependencies**: `src/main/agent-manager/dependency-index.ts` (in-memory reverse index, cycle detection), `src/main/agent-manager/resolve-dependents.ts` (blocked→queued transitions). Tasks can declare `depends_on: TaskDependency[]` with `hard` (block on failure) or `soft` (unblock regardless) edges. `blocked` status = unsatisfied hard deps. Resolution triggered from all terminal status paths.
- **PR poller**: `src/main/pr-poller.ts` — polls open PRs from all configured repos every 60s, fetches check runs, broadcasts `pr:listUpdated` to renderer. Separate from sprint PR poller.
- **Sprint PR poller**: `src/main/sprint-pr-poller.ts` — runs every 60s in main process (not renderer-dependent), polls PR status for tasks with `pr_status='open'`. Auto-marks tasks done (merged) or cancelled (closed).
- **State**: Zustand stores in `src/renderer/src/stores/`
- **IPC**: 17 handler modules in `src/main/handlers/`, registered in `src/main/index.ts`, preload bridge in `src/preload/index.ts`. 86 typed channels in `src/shared/ipc-channels.ts`.
- **Agent spawning**: `src/main/agent-manager/sdk-adapter.ts` spawns agents via `@anthropic-ai/claude-agent-sdk` (with CLI fallback). OAuth token read from `~/.bde/oauth-token` at startup — Keychain access hangs in Electron's main process, so the file-based approach is required.
- **Native agent system**: `src/main/agent-system/` — custom BDE-specific agent infrastructure (personality, memory, skills) replaces third-party plugin scripts. Controlled by `agentManager.useNativeSystem` setting (default false). When enabled, agents receive tailored personalities (pipeline = concise/action-oriented, assistant = conversational/proactive), BDE conventions (IPC patterns, testing standards, architecture rules), and interactive skills (system introspection, task orchestration, code patterns). Skills only injected for assistant/adhoc agents, not pipeline. Prompt assembly via `prompt-composer.ts` `buildAgentPrompt()` function. See `docs/agent-system-guide.md` for architecture, usage, and migration guide.
- **DB sync**: File watcher on `bde.db` pushes `sprint:externalChange` IPC events to renderer (500ms debounce)
- **Design tokens**: `src/renderer/src/design-system/tokens.ts` — use these instead of hardcoded values. Neon theme tokens in CSS custom properties (`neon.css`, `neon-shell.css`, `agents-neon.css`).
- **Neon components**: `src/renderer/src/components/neon/` (12 primitives: NeonCard, StatCounter, NeonBadge, GlassPanel, ActivityFeed, NeonProgress, PipelineFlow, MiniChart, StatusBar, ScanlineOverlay, ParticleField, NeonTooltip). Used by Dashboard + Agents views. Glass morphism, glow effects, terminal aesthetic.
- **MiniChart accent**: `MiniChart` uses `data[0].accent` for the entire line color. Per-point `accent` values on `ChartBar[]` are ignored — don't cycle colors thinking they'll render differently.
- **Agent events**: `src/main/agent-event-mapper.ts` — shared `mapRawMessage()` (SDK wire protocol → `AgentEvent[]`) + `emitAgentEvent()` (broadcast + SQLite persist). Used by both `adhoc-agent.ts` (user-spawned) and `run-agent.ts` (pipeline agents).
- **Agent events cap**: `src/renderer/src/stores/agentEvents.ts` caps at 2000 events per agent (oldest evicted). Both `init()` subscriber and `loadHistory()` enforce the cap.
- **Panel system**: `src/renderer/src/stores/panelLayout.ts` — recursive PanelNode tree (leaf/split), `src/renderer/src/components/panels/` — PanelRenderer, PanelLeaf, PanelTabBar, PanelDropOverlay. Layout persists to `panel.layout` setting. Views rendered inside panels; drag-and-drop docking with 5-zone hit testing.
- **Views**: 8 views in `src/renderer/src/views/` — Dashboard (⌘1), Agents (⌘2), IDE (⌘3, default), Task Pipeline (⌘4), Code Review (⌘5), Source Control (⌘6), Settings (⌘7), Task Workbench. Task Pipeline = execution monitoring (vertical pipeline flow); Task Workbench = planning/creation (form + AI copilot). View type union and `VIEW_LABELS` live in `panelLayout.ts`. Keyboard shortcuts mapped in `App.tsx` via `VIEW_SHORTCUT_MAP`.
- **IDE**: `src/renderer/src/views/IDEView.tsx` + `src/renderer/src/components/ide/` (9 components). Monaco editor + file explorer sidebar + integrated terminal. `ideStore` in `src/renderer/src/stores/ide.ts`. File I/O via `ide-fs-handlers.ts` (path-scoped to opened root, atomic writes, binary detection). State persisted to `ide.state` setting with 2s debounce.
- **Code Review**: `src/renderer/src/views/CodeReviewView.tsx` + `src/renderer/src/components/code-review/` (ReviewQueue, ReviewDetail, ReviewActions, ChangesTab, CommitsTab, ConversationTab). `codeReview` Zustand store. Agent completion stops at `review` status with worktree preserved. User reviews diffs/commits, then merges locally, creates PR, requests revision, or discards. Task statuses include `review` between `active` and `done`. Replaces the previous PR Station components.
- **Source Control**: `src/renderer/src/views/GitTreeView.tsx` + `src/renderer/src/components/git-tree/` (5 components: GitFileRow, FileTreeSection, CommitBox, BranchSelector, InlineDiffDrawer). `gitTree` Zustand store in `src/renderer/src/stores/gitTree.ts`. Uses existing git IPC channels (`git:status`, `git:diff`, `git:stage`, `git:unstage`, `git:commit`, `git:push`, `git:branches`). Polls at `POLL_GIT_STATUS_INTERVAL` (30s). Store tracks `commitLoading`/`pushLoading`/`lastError` for operation feedback; CommitBox shows loading spinners, GitTreeView renders persistent error banner with Retry/Dismiss.
- **Dashboard**: `src/renderer/src/views/DashboardView.tsx` + `src/renderer/src/components/dashboard/` (5 components: StatusCounters, ChartsSection, ActivitySection, SuccessRing, CenterColumn). Aggregates data from `sprintTasks`, `costData` stores and PR list IPC. Default landing view. Polls every 60s via `useBackoffInterval` (with jitter + exponential backoff on errors).
- **Logging**: `src/main/logger.ts` — `createLogger(name)` writes to `~/.bde/bde.log` with `[LEVEL] [module]` format + ISO timestamps. Rotates at 10MB (renames to `.old`, keeps 1 generation). Checks rotation on creation + every 1000 writes. Agent-manager has its own `~/.bde/agent-manager.log` with similar rotation. Sprint-queries uses injectable logger via `setSprintQueriesLogger()`.
- **Optimistic updates**: `src/renderer/src/stores/sprintTasks.ts` — field-level tracking via `pendingUpdates: Record<string, { ts: number; fields: string[] }>`. On poll merge, only pending fields are preserved from local state; all other fields come from server. 2-second TTL. Full reload on failure (safest revert).
- **Task Pipeline**: `src/renderer/src/components/sprint/SprintPipeline.tsx` — three-zone layout (PipelineBacklog | PipelineStage×5 | TaskDetailDrawer). Uses `partitionSprintTasks()` for stage mapping. Neon CSS in `sprint-pipeline-neon.css`. Task creation removed from pipeline (lives in Task Workbench only).
- **Task Workbench**: `src/renderer/src/components/task-workbench/` — form + AI copilot + readiness checks. Neon CSS in `task-workbench-neon.css` (`.wb-*` BEM classes). Copilot uses Agent SDK streaming via `workbench:chatStream` IPC.
- **Full architecture**: See `docs/architecture.md`


## Packaging

```bash
npm run build:mac    # Build unsigned macOS arm64 DMG → release/BDE-*.dmg
npm run package      # Alias for build:mac
```

- **Prerequisites for users**: Claude Code CLI installed + `claude login`, `git`, `gh` CLI
- **Unsigned**: `identity: null` in electron-builder.yml — users right-click → Open to bypass Gatekeeper
- **Onboarding**: App shows auth check screen on first launch with checks for CLI, token, git, repos (optional). Optional checks warn but don't block. Auto-skips for returning users with valid token.

## Key Conventions

- TypeScript strict mode
- Zustand for all client state
- `lucide-react` for icons
- `react-resizable-panels` for panel layouts (`orientation` prop, not `direction`)
- ARIA accessibility: landmarks (`<main>`, `<nav>`), dialog semantics (`role="dialog"`, `aria-modal`), tab patterns (`role="tablist"`/`role="tab"`), live regions on ToastContainer. Maintain these when adding new UI.
- Max one Zustand store per domain concern
- Polling intervals centralized in `src/renderer/src/lib/constants.ts`
- Use `useBackoffInterval` (not raw `setInterval`) for new polling — provides jitter + backoff
- New main-process modules: use `createLogger(name)` from `src/main/logger.ts` — not raw `console.*`
- Agent manager data access: always through `ISprintTaskRepository`, never direct sprint-queries imports
- WIP limit (`MAX_ACTIVE_TASKS`) enforced at agent manager drain loop — don't rely on UI-only enforcement
- Task dependency validation runs before creation — no create-then-rollback patterns
- Audit trail is automatic — `updateTask()` records field-level diffs to `task_changes` table
- Optimistic updates track fields, not just task IDs — only pending fields preserved on poll merge
