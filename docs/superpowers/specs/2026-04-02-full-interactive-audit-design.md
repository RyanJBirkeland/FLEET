# Full Interactive Element & Decomposition Audit — Design Spec

**Date:** 2026-04-02
**Goal:** Audit every interactive element (buttons, clicks, forms) across the entire BDE renderer for functional correctness, state consistency, error handling, accessibility, and visual correctness. Simultaneously audit component decomposition and architecture.

## Audit Structure: Hybrid Domain + Specialist Teams

### Phase 1: Domain Teams (Functionality-First)

Six domain teams, each auditing all interactive elements within their scope. Every team checks all 5 lenses but **functionality is the primary lens** — does every button/click/handler actually do what it claims?

#### Team 1: Task Management

**Scope:** SprintPipeline, TaskDetailDrawer, PipelineBacklog, PipelineStage, PipelineFilterBar, TaskPill, TicketEditor, DoneHistoryPanel, HealthCheckDrawer, ConflictDrawer, SpecPanel
**Personality:** Meticulous QA engineer who clicks every button in every state combination. Skeptical — assumes nothing works until proven otherwise.
**Key focus:** Task state transitions (backlog→queued→active→review→done), filter buttons, drawer open/close, spec links, priority toggles, dependency actions.
**Files:**

- `src/renderer/src/views/SprintView.tsx`
- `src/renderer/src/components/sprint/*.tsx`
- Related stores: `sprintTasks.ts`, `panelLayout.ts`
- Related CSS: `sprint-pipeline-neon.css`, `sprint-neon.css`, `sankey-pipeline-neon.css`

#### Team 2: Agents & Terminal

**Scope:** AgentsView, AgentCard, AgentList, AgentLaunchpad, AgentPill, ConsoleLine, ConsoleHeader, ConsoleSearchBar, ToolCallBlock, ChatBubble, ThinkingBlock, LiveActivityStrip, PlaygroundModal, PlaygroundCard, TerminalPane, TerminalTabBar, TerminalToolbar, TerminalContent, AgentOutputTab, ShellPicker, AgentPicker, FindBar
**Personality:** Power user who spawns multiple agents, switches between terminals rapidly, searches console output, and opens playgrounds. Impatient — expects instant feedback.
**Key focus:** Agent spawn/stop buttons, console search, terminal tab add/close/scroll, playground open/close/view-mode toggle, shell/agent picker selection, find bar next/prev/close.
**Files:**

- `src/renderer/src/views/AgentsView.tsx`
- `src/renderer/src/components/agents/*.tsx`
- `src/renderer/src/components/terminal/*.tsx`
- Related stores: `agentEvents.ts`, `agentStore.ts`
- Related CSS: `agents-neon.css`, `agent-launchpad-neon.css`, `terminal.css`

#### Team 3: Code Review & Source Control

**Scope:** CodeReviewView, ReviewQueue, ReviewDetail, ReviewActions, ChangesTab, CommitsTab, ConversationTab, DiffViewer, DiffCommentWidget, DiffCommentComposer, DiffSizeWarning, GitTreeView, GitFileRow, BranchSelector, CommitBox, FileTreeSection, InlineDiffDrawer
**Personality:** Senior developer doing code review who cares about correctness of merge/PR/discard actions. Paranoid about data loss — what happens if you click "Discard" accidentally?
**Key focus:** Merge Locally / Create PR / Request Revision / Discard buttons (these are high-stakes), diff file selection, commit/push with error states, branch switching, stage/unstage individual files vs sections, inline diff drawer toggle.
**Files:**

- `src/renderer/src/views/CodeReviewView.tsx`
- `src/renderer/src/components/code-review/*.tsx`
- `src/renderer/src/components/diff/*.tsx`
- `src/renderer/src/views/GitTreeView.tsx`
- `src/renderer/src/components/git-tree/*.tsx`
- Related stores: `codeReview.ts`, `gitTree.ts`
- Related CSS: `code-review-neon.css`, `diff.css`, `diff-neon.css`, `source-control-neon.css`

#### Team 4: Dashboard

**Scope:** DashboardView, DashboardCard, ActiveTasksCard, RecentCompletionsCard, CostSummaryCard, OpenPRsCard, StatCounter, NeonCard, ActivityFeed, MiniChart, NeonProgress, PipelineFlow
**Personality:** Product manager checking that every metric is accurate and every click navigates to the right place. Numbers-focused — questions whether displayed data matches reality.
**Key focus:** Status counter clicks (do they navigate/filter correctly?), activity feed item clicks, pipeline flow stage clicks, refresh behavior, data accuracy (known bug: 24h cost shows lifetime cost).
**Files:**

- `src/renderer/src/views/DashboardView.tsx`
- `src/renderer/src/components/dashboard/*.tsx`
- `src/renderer/src/components/neon/*.tsx` (shared primitives used by dashboard)
- Related stores: `sprintTasks.ts`, `costData.ts`
- Related CSS: `dashboard-neon.css`, `neon.css`, `neon-primitives.css`

#### Team 5: Task Workbench

**Scope:** TaskWorkbenchView, TaskWorkbench, WorkbenchForm, SpecEditor, WorkbenchCopilot, WorkbenchActions, ReadinessChecks
**Personality:** New user trying to create their first task. Confused by jargon — expects clear affordances, helpful error messages, and obvious next steps.
**Key focus:** Form field interactions, copilot send/clear, spec type toggle, playground toggle, readiness check run button, queue button enable/disable logic, template selection.
**Files:**

- `src/renderer/src/views/TaskWorkbenchView.tsx`
- `src/renderer/src/components/task-workbench/*.tsx`
- Related stores: `copilotStore.ts` (if exists), `sprintTasks.ts`
- Related CSS: `task-workbench-neon.css`

#### Team 6: IDE & Settings & App Shell

**Scope:** IDEView, FileTree, EditorTabBar, TerminalPanel, EditorPane, FileSidebar, FileContextMenu, UnsavedDialog, FileTreeNode, IDEEmptyState, SettingsView (all 9 tabs), NeonSidebar, UnifiedHeader, CommandPalette, OverflowMenu, NotificationBell, ToastContainer, TearoffShell, TearoffTabBar, PanelRenderer, PanelLeaf, PanelTabBar, PanelDropOverlay, ConfirmModal, PromptModal, Button, EmptyState
**Personality:** Keyboard-centric developer who expects every action reachable via keyboard, tabs through everything, uses Cmd shortcuts, and resizes panels constantly. Allergic to mouse-only interactions.
**Key focus:** Keyboard shortcuts (Cmd+1-7, Cmd+B/J/O/S/W), file tree expand/collapse/open, editor tab close/switch/dirty-state, settings tab arrow-key navigation, command palette open/search/select, sidebar view switching, panel drag-drop, tearoff window lifecycle, confirm/prompt modal button wiring.
**Files:**

- `src/renderer/src/views/IDEView.tsx`
- `src/renderer/src/components/ide/*.tsx`
- `src/renderer/src/views/SettingsView.tsx`
- `src/renderer/src/components/settings/*.tsx`
- `src/renderer/src/components/layout/*.tsx`
- `src/renderer/src/components/panels/*.tsx`
- `src/renderer/src/components/ui/*.tsx`
- Related stores: `ide.ts`, `panelLayout.ts`
- Related CSS: `ide.css`, `ide-neon.css`, `settings.css`, `settings-neon.css`, `neon-shell.css`, `command-palette.css`

### Phase 2: Cross-Cutting Specialist Agents

Run after domain teams complete. These sweep the entire app through a single lens.

#### Specialist A: Accessibility Auditor

**Personality:** Strict WCAG 2.1 AA auditor. Every interactive element must be keyboard reachable, have visible focus indicators, use semantic HTML (`<button>` not `<div onClick>`), have aria-labels where text isn't visible, and support screen readers.
**Checklist:**

- [ ] Every `onClick` on a non-button element has `role="button"` + `tabIndex={0}` + `onKeyDown` for Enter/Space
- [ ] Every `<button>` has accessible text (visible label or `aria-label`)
- [ ] Focus-visible styles exist for all interactive elements
- [ ] Tab order follows visual layout
- [ ] Modals trap focus and return it on close
- [ ] Live regions announce dynamic content changes (toasts, status updates)
      **Scope:** All 126 component files + 8 views

#### Specialist B: Visual & Theme Auditor

**Personality:** Designer who toggles between dark and light themes obsessively. Checks every button looks correct in both themes, uses CSS custom properties (never hardcoded colors), and follows BDE design system conventions.
**Checklist:**

- [ ] No hardcoded `rgba()`, `#fff`, `#000` in component styles — must use `var(--bde-*)` or `var(--neon-*)`
- [ ] No inline `style={{}}` on interactive elements — must use CSS classes
- [ ] `.bde-btn` variants used consistently (ghost, primary, danger)
- [ ] Buttons have hover/active/disabled visual states in CSS
- [ ] Light theme (`html.theme-light`) renders all buttons legibly
- [ ] Neon glow effects don't obscure button text
      **Scope:** All 32 CSS files + component files with inline styles

#### Specialist C: Architecture & Decomposition Auditor

**Personality:** Clean Code evangelist. Components should do one thing. Files over 300 lines are suspicious. Prop drilling past 2 levels is a smell. State that's duplicated across stores is a bug waiting to happen.
**Checklist:**

- [ ] Components with >15 interactive handlers should be split
- [ ] Identify god components (>400 lines, multiple responsibilities)
- [ ] Flag prop drilling (>2 levels deep)
- [ ] Check for duplicate state across Zustand stores
- [ ] Identify dead code (unused components, orphaned CSS classes, unreachable handlers)
- [ ] Verify component boundaries align with domain concerns
- [ ] Check for tangled imports between domain directories
- [ ] Flag any `useEffect` chains that could be simplified
      **Scope:** All component directories, stores, views

## Audit Report Format

Each agent produces a markdown report with:

```markdown
# [Team Name] Audit Report — 2026-04-02

## Summary

- Total interactive elements audited: N
- Issues found: N (X critical, Y medium, Z low)

## Critical Issues (broken functionality)

### [C1] Button X does nothing when clicked

- **File:** `path/to/file.tsx:123`
- **Element:** `<button onClick={handleFoo}>Do Thing</button>`
- **Expected:** Should call API and update state
- **Actual:** Handler is a no-op / handler throws silently / handler calls wrong function
- **Fix:** [specific suggestion]

## Medium Issues (state/error/visual)

### [M1] Button Y doesn't disable during loading

...

## Low Issues (a11y/polish)

### [L1] Missing aria-label on icon button

...

## Decomposition Notes (domain teams only)

- Components that should be split
- Responsibilities that are tangled
```

## Output Location

All reports written to `docs/superpowers/audits/2026-04-02-interactive-audit/`:

- `team-1-task-management.md`
- `team-2-agents-terminal.md`
- `team-3-code-review-git.md`
- `team-4-dashboard.md`
- `team-5-task-workbench.md`
- `team-6-ide-settings-shell.md`
- `specialist-a-accessibility.md`
- `specialist-b-visual-theme.md`
- `specialist-c-architecture.md`
- `synthesis.md` (created after all teams report — cross-references, deduplicates, prioritizes)

## Success Criteria

1. Every `onClick`, `<button>`, `role="button"`, and `onSubmit` in the renderer has been inspected
2. Every broken or no-op handler is documented with file:line and fix suggestion
3. State issues (wrong disable logic, missing loading states) are cataloged
4. Accessibility gaps have specific remediation steps
5. Decomposition issues identify which components to split and how
6. Final synthesis provides a prioritized remediation backlog
