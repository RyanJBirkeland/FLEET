# Clean Architecture Audit — BDE

**Date:** 2026-03-20
**Audited by:** Claude (requested by Ryan)

---

## Executive Summary

- **Overall architectural health: B-**
- **High Cohesion, Low Coupling status:** Strong at boundaries (main/preload/renderer), weak in middle layers (use cases scattered across handlers, stores, and components)
- **Top 3 wins:**
  1. Shared types layer (`src/shared/`) is pure — zero framework imports, type-safe IPC contracts
  2. Process boundaries (main/preload/renderer) are well-respected with clean preload bridge
  3. Zustand stores are isolated (no inter-store dependencies), UI primitives are pure
- **Top 3 priorities:**
  1. Extract use case layer — business logic scattered across IPC handlers, Zustand stores, and React components
  2. Decompose god modules — SettingsView (841 LOC), SprintCenter (458 LOC), sprint-local.ts (469 LOC)
  3. Fix `AgentEvent` type placement — shared layer imports from main, breaking dependency direction

---

## Structural Overview

| Metric | Value |
|--------|-------|
| Total source LOC | ~33,500 |
| TypeScript files | 243 |
| Test files | 63 |
| Zustand stores | 16 |
| IPC handler modules | 10 |
| Views | 7 |
| Files > 300 LOC | 13 (source only) |

**Organization:** By process boundary (main/preload/renderer/shared) with domain grouping within renderer (stores, components, views, lib, hooks). Main process organized by concern (handlers, agents, queue-api).

**Recent activity:** Phase 3 (Pluggable Panels) just merged. Sprint UI and agent system see highest churn.

---

## Dependency Direction Map

### Expected Flow (Clean Architecture)

```
renderer →(IPC)→ preload →(types)→ shared ←(imports)← main
```

### Violations Found: 3 (Single Root Cause)

All violations stem from `AgentEvent` type being placed in `src/main/agents/types.ts` instead of `src/shared/types.ts`.

| # | File | Line | Violation |
|---|------|------|-----------|
| 1 | `src/shared/ipc-channels.ts` | 11 | Shared layer imports from `../main/agents/types` |
| 2 | `src/preload/index.ts` + `index.d.ts` | 6, 5 | Preload imports from `../main/agents/types` |
| 3 | `src/renderer/src/stores/agentEvents.ts`, `components/agents/AgentDetail.tsx`, `ChatRenderer.tsx` | various | Renderer imports from main process types |

**Fix:** Move `AgentEvent` and `AgentEventType` to `src/shared/types.ts`. Update 7 import statements. Low complexity.

### Healthy Boundaries

- **React isolation:** Zero React imports in main, shared, or preload
- **Database isolation:** `better-sqlite3` only in `src/main/db.ts` (+ tests)
- **Electron isolation:** 10 files import Electron, all in main process or preload
- **Type abstraction:** DB row types (`AgentRunRow`) mapped to shared types (`AgentMeta`) before crossing IPC boundary

### Swap Test Results

| Framework | If Swapped... | Files Affected | Business Logic Impact |
|-----------|---------------|----------------|----------------------|
| React | → Vue/Svelte | Renderer only | None |
| better-sqlite3 | → PostgreSQL | ~5 files in main | None (queries isolated) |
| Electron | → Tauri | ~10 files in main | ~30% of main process |
| Zustand | → Redux/Jotai | 16 store files | None (stores isolated) |

---

## Layer Boundary Analysis

| Layer | Status | Location | Grade |
|-------|--------|----------|-------|
| **Entities/Domain** | Excellent | `src/shared/` | A+ |
| **Use Cases** | Missing/Scattered | Handlers + stores + components | D |
| **Interface Adapters** | Partial | `src/main/handlers/`, `src/preload/`, `src/main/queue-api/` | C+ |
| **Frameworks & Drivers** | Well-contained | `src/renderer/`, `src/main/index.ts`, `src/main/db.ts` | B |

### Key Issues

**1. No Use Case Layer**

Business logic is scattered across three locations:
- **IPC Handlers** (`sprint-local.ts:125-143`): Task CRUD with direct SQL
- **Zustand Stores** (`sprint.ts:82-94`): Optimistic updates, error recovery, polling
- **React Components** (`SprintCenter.tsx:86-200`): Event handlers with business logic

No single place owns "update a sprint task" — the operation spans 3 files in 2 processes.

**2. No Repository Pattern**

Database queries live in handler files:
```typescript
// src/main/handlers/sprint-local.ts:90-92
export function getTask(id: string): SprintTask | null {
  return getDb().prepare('SELECT * FROM sprint_tasks WHERE id = ?').get(id) as SprintTask | null
}
```

Both IPC handlers and queue-api router call these functions directly. No abstraction boundary between business logic and data access.

**3. Zustand Stores Double as Use Case Orchestrators**

Stores mix state management (Zustand concern) with business orchestration (use case concern):
```typescript
// sprint.ts — mixes framework state with business logic
loadData: async () => {
  set({ loading: true })                    // Framework: Zustand state
  const result = await window.api.sprint.list()  // Business: IPC call
  set({ tasks: result })                    // Framework: Zustand state
}
```

---

## SOLID Violations

### Summary

| Principle | HIGH | MEDIUM | LOW | Total |
|-----------|------|--------|-----|-------|
| Single Responsibility | 4 | 10 | 2 | 16 |
| Open/Closed | 1 | 2 | 3 | 6 |
| Liskov Substitution | 0 | 0 | 0 | 0 |
| Interface Segregation | 1 | 5 | 1 | 7 |
| Dependency Inversion | 0 | 8 | 2 | 10 |

### HIGH Severity Violations

| Principle | File | Description |
|-----------|------|-------------|
| **SRP** | `views/SettingsView.tsx` (841 LOC) | 6+ responsibilities: appearance, gateway config, GitHub auth, repos CRUD, templates CRUD, agent config |
| **SRP** | `handlers/sprint-local.ts` (469 LOC) | Task CRUD, mutation broadcasting, file I/O, gateway RPC, queue stats — 10+ concerns |
| **SRP** | `components/sprint/SprintCenter.tsx` (458 LOC) | Task state, repo filtering, log drawer, PR conflicts, health checks, keyboard shortcuts, DnD, modals |
| **SRP** | `views/SettingsView.tsx:352-687` | ConnectionsSection (335 LOC): 3x copy-pasted credential test/save/show logic |
| **OCP** | `views/SettingsView.tsx:352-687` | Adding a new credential type requires ~120 LOC copy-paste |
| **ISP** | `stores/sprint.ts:15-45` | SprintState: 28 properties bundling tasks, UI state, PR state, output events, queue health |

### Notable MEDIUM Violations

| Principle | File | Description |
|-----------|------|-------------|
| **SRP** | `components/sprint/NewTicketModal.tsx` (454 LOC) | 3 mode tabs, spec generation, template selection, form state, focus management |
| **SRP** | `components/sprint/TicketEditor.tsx` (436 LOC) | JSON parsing, CRUD, prompt expansion, inline styles (294 LOC) |
| **SRP** | `stores/panelLayout.ts` (428 LOC) | Tree mutation + persistence + debounced saves + ID generation |
| **DIP** | `handlers/sprint-local.ts:369-420` | Handler manually constructs fetch URL + AbortController for gateway HTTP |
| **DIP** | `stores/panelLayout.ts:378-386` | Store directly calls `window.api.settings.setJson()` — persistence baked in |
| **DIP** | `main/db.ts:7-20` | `getDb()` singleton with no injection — all callers depend on hardcoded instance |

---

## Clean Code Findings

### Naming

| Finding | Location | Severity |
|---------|----------|----------|
| Inconsistent getter verbs | `getTask` vs `listTasks` vs `loadData` vs `fetchProcesses` vs `fetchSessions` | Low |
| Opaque dual maps | `local-agents.ts:36-39` — `activeAgentProcesses` + `activeAgentsById` unclear relationship | Low |
| Magic numbers | `git.ts:164` — `timeoutMs: 10_000`, `KanbanBoard.tsx:18` — `distance: 5` | Low |

### Functions

| Finding | Location | Severity |
|---------|----------|----------|
| Mixed abstraction levels | `KanbanBoard.tsx:56-220` — DnD orchestration mixed with string filtering and array manipulation | Medium |
| Mixed abstraction levels | `git.ts:21-48` — `gitStatus()` mixes high-level fetch with low-level string slicing | Medium |
| Side effects hidden in name | `local-agents.ts:183` — `consumeEvents()` is fire-and-forget `.catch(() => {})` | Medium |
| Side effects cascade | `SprintCenter.tsx:161-184` — `handleStop()` does 5 things: confirm, kill, update, notify, toast | Medium |

### Error Handling

| Finding | Location | Severity |
|---------|----------|----------|
| Empty catches (silent failures) | `git.ts:45-47, 58-60, 120-122, 234-236` — 4 git operations swallow errors | High |
| Fire-and-forget | `local-agents.ts:183` — `.catch(() => {})` swallows all errors | High |
| Inconsistent patterns | `sprint-local.ts` — same operation uses throw in one place, return null in another | Medium |
| Error messages lack context | `git-handlers.ts:33` — "GitHub token not configured" doesn't say how to fix it | Low |

### Dead Code / Smells

| Finding | Location | Severity |
|---------|----------|----------|
| `as never` type escape | `sprint.ts:292-296` — `event as never` hides type mismatch | Medium |
| Noop callbacks | `KanbanBoard.tsx:150` — `const noop = () => {}` used 5 times for DragOverlay | Low |
| Module-scope mutable state | `panelLayout.ts:420-428` — `_saveTimeout` outside Zustand store | Medium |
| Leaked test utilities | `local-agents.ts:19-31` — `_resetProcessCache()` exported in production | Low |

---

## Module Scorecard

| Module | Grade | Cohesion | Coupling | Evidence |
|--------|-------|----------|----------|----------|
| `src/shared/types` | **A** | Very High | Low | Pure read-only contracts, zero deps |
| `src/shared/ipc-channels` | **A** | Very High | Low | Single source of truth for IPC |
| `src/preload/index` | **A** | Very High | Low | Clean bridge, no business logic |
| `src/renderer/src/components/ui/` | **A** | Very High | Low | 14 pure primitives |
| `src/renderer/src/lib/` | **A** | High | Low | Pure utility functions |
| `src/renderer/src/hooks/` | **A** | High | Low | Reusable logic extraction |
| `src/renderer/src/stores/` | **A** | High | Low | Each store single-concern, no inter-deps |
| `src/main/db.ts` | **B** | High | Medium | Well-encapsulated singleton, 10 callers |
| `src/main/handlers/` (most) | **B** | High | Medium | Thin wrappers via safeHandle() |
| `src/main/agents/` | **B** | High | Medium | Clean factory pattern |
| `src/main/queue-api/` | **B** | High | Medium | Well-isolated HTTP layer |
| `src/renderer/src/components/panels/` | **B** | High | Medium | Tight internal cohesion |
| `src/main/index.ts` | **C** | Medium | High | Hub bootloader: 26 imports, registers all services |
| `src/main/handlers/sprint-local.ts` | **C** | Medium | High | 469 LOC: CRUD + listeners + spec I/O + SQL |
| `src/main/local-agents.ts` | **C** | Medium | Medium | 355 LOC: spawn + kill + cost + logs |
| `src/renderer/src/components/sprint/` | **D** | Low | High | 4,141 LOC total, SprintCenter orchestrates 9+ sub-components |
| `src/renderer/src/views/SettingsView.tsx` | **D** | Low | High | 841 LOC monolith, 30 useState hooks, 6 feature domains |

---

## Framework Independence

| Framework | Files Importing | Coupling Level | Business Logic Impact |
|-----------|----------------|----------------|-----------------------|
| **Electron** | 10 files | High (main process) | Preload sandbox=false, PTY lifecycle tied to BrowserWindow |
| **React** | Renderer only | Low | Zero React in business logic, pure UI layer |
| **better-sqlite3** | ~10 files (all main) | Medium | No DAO abstraction, but queries isolated to main process |
| **Zustand** | 16 store files | Low | Stores mix state + business logic, but swappable |

### Electron-Specific Concerns

- `sandbox: false` required because preload exposes Node.js APIs via contextBridge
- PTY terminal lifecycle coupled to `BrowserWindow.fromWebContents()`
- `queue-api/router.ts` imports BrowserWindow just for broadcasting (presentation leaking into HTTP API)
- File dialogs (`dialog.showOpenDialog`) not abstracted

---

## Testability Assessment

### Coverage by Layer

| Layer | Testable? | Coverage | Quality | Notes |
|-------|-----------|----------|---------|-------|
| **Shared types/utils** | Yes | ~80% | A+ | Pure functions, no mocking needed |
| **DB schema/migrations** | Yes | ~100% | A+ | In-memory SQLite testing |
| **DB queries** | Indirect | ~30% | B- | Only tested via mocked IPC handlers |
| **IPC handlers** | Via mocks | ~60% | B | Tests wiring, not business logic |
| **Zustand stores** | Yes | ~70% | B+ | Happy path covered, edge cases missing |
| **React components** | Shallow | ~40% | C+ | Heavy library mocking, miss real interactions |
| **Terminal/PTY** | Hard | ~10% | D | Tight Electron coupling, lazy CJS require |
| **Real-time events** | Hard | ~20% | D | Mocks hide complexity |
| **E2E** | None | 0% | F | No end-to-end tests |

### Key Testability Gaps

1. **Query logic untested in isolation** — queries live in handlers, only tested indirectly through mocked IPC
2. **Components require heavy mocking** — dnd-kit, lucide-react, window.api all must be stubbed
3. **Terminal untestable** — node-pty lazy-loaded via CJS require, PTY events wired to BrowserWindow
4. **No integration tests** — no tests for handler → DB → response flow with real database

---

## Refactoring Roadmap

### Tier 1: High Impact, Low Effort (Do First)

#### Move AgentEvent to Shared Types
- **What:** Move `AgentEvent` and `AgentEventType` from `src/main/agents/types.ts` to `src/shared/types.ts`
- **Why:** Shared layer imports from main, breaking dependency direction — the only import rule violation
- **Coupling impact:** Eliminates all 3 dependency direction violations
- **Files affected:** 7 files (import path changes only)
- **Complexity:** Very Low (~30 minutes)

#### Split SprintState Store
- **What:** Partition `sprint.ts` (28 properties) into: `useSprintTasks` (CRUD), `useSprintUI` (selection, drawers), `useSprintEvents` (SSE, output)
- **Why:** Single store bundles 5+ unrelated concerns; all sprint components subscribe to everything
- **Coupling impact:** Reduces unnecessary re-renders, isolates concerns
- **Files affected:** ~8 files
- **Complexity:** Low

#### Extract Query Functions for Testability
- **What:** Move raw SQL queries from `sprint-local.ts` into `src/main/data/sprint-queries.ts`, parameterize with `db` argument
- **Why:** Queries only tested indirectly through mocked IPC — can't catch SQL bugs
- **Coupling impact:** Enables real in-memory DB testing for all queries
- **Files affected:** ~4 files
- **Complexity:** Low

### Tier 2: High Impact, Medium Effort

#### Decompose SettingsView
- **What:** Split 841 LOC into: `SettingsView` (tab container, 50 LOC), `AppearanceSettings`, `ConnectionSettings`, `RepositorySettings`, `TemplateSettings`, `AgentSettings`
- **Why:** 6 feature domains in one file, 30 useState hooks, impossible to test sections independently
- **Coupling impact:** Each section becomes independently testable and maintainable
- **Files affected:** 1 file → 6 files
- **Complexity:** Medium

#### Decompose SprintCenter
- **What:** Extract from 458 LOC into: `SprintCenter` (layout, 150 LOC), `SprintToolbar` (filters, create), custom hooks (`useSprintPolling`, `useSprintKeyboardShortcuts`)
- **Why:** 53 hook/store accesses in one component; shotgun surgery on task model changes
- **Coupling impact:** Reduces store selectors from 53 to ~10 per component
- **Files affected:** ~4 files
- **Complexity:** Medium

#### Extract Sprint Handler Concerns
- **What:** Split `sprint-local.ts` (469 LOC) into: `sprint-crud.ts` (CRUD operations), `sprint-spec.ts` (spec file I/O + generation), `sprint-listeners.ts` (mutation observer)
- **Why:** Handler file mixes CRUD, file I/O, gateway RPC, and event subscription
- **Coupling impact:** Queue API router imports specific module instead of monolith
- **Files affected:** ~5 files
- **Complexity:** Medium

#### Introduce Credential Form Component
- **What:** Replace 3x copy-pasted credential sections in ConnectionsSection with data-driven `CredentialForm` component
- **Why:** Adding a new credential type currently requires ~120 LOC copy-paste
- **Coupling impact:** Eliminates 240 LOC duplication
- **Files affected:** 1 file
- **Complexity:** Low-Medium

### Tier 3: Structural (Plan For)

#### Introduce Repository Pattern
- **What:** Create `src/main/repositories/` with `SprintTaskRepository`, `AgentRunRepository`, `CostRepository` interfaces + SQLite implementations
- **Why:** 10 files directly call `getDb()` — no abstraction between business logic and data access
- **Coupling impact:** Enables DB swapping, caching layer, transaction boundaries
- **Files affected:** ~10 files
- **Complexity:** Medium-High

#### Create Use Case Layer
- **What:** Add `src/main/use-cases/` with: `CreateTask`, `LaunchTask`, `UpdateTaskStatus`, `GenerateSpec`
- **Why:** Business rules split across IPC handlers, Zustand stores, and components — no single owner
- **Coupling impact:** Single place for business rules; handlers become thin dispatchers, stores become pure state machines
- **Files affected:** ~15 files
- **Complexity:** High

#### Decouple Terminal from Electron
- **What:** Extract `createPtyProcess()` and `attachPtyDataListener()` as pure functions, wire to Electron in handler registration only
- **Why:** Terminal logic untestable due to tight BrowserWindow coupling
- **Coupling impact:** Enables PTY unit testing without Electron
- **Files affected:** ~3 files
- **Complexity:** Medium

### Dependency Graph: Current vs Target

**Current:**
```
Component → Store → window.api → IPC Handler → getDb() → SQL
              ↓                       ↓
         business logic          business logic
```

**Target:**
```
Component → Store (pure state) → window.api → IPC Handler (thin)
                                                    ↓
                                              Use Case (business logic)
                                                    ↓
                                              Repository (data access)
                                                    ↓
                                                   SQL
```

---

## Appendix: Files Over 300 LOC

| File | LOC | Primary Concern |
|------|-----|-----------------|
| `views/SettingsView.tsx` | 841 | Settings UI (6 domains) |
| `handlers/sprint-local.ts` | 469 | Sprint task operations |
| `components/sprint/SprintCenter.tsx` | 458 | Sprint orchestrator |
| `components/diff/DiffViewer.tsx` | 456 | Git diff viewer |
| `components/sprint/NewTicketModal.tsx` | 454 | Task creation modal |
| `components/sprint/TicketEditor.tsx` | 436 | Task inline editor |
| `stores/panelLayout.ts` | 428 | Panel tree state |
| `components/sprint/TaskTable.tsx` | 373 | Task table view |
| `main/local-agents.ts` | 355 | Agent process management |
| `shared/ipc-channels.ts` | 343 | IPC type map |
| `components/terminal/TerminalTabBar.tsx` | 341 | Terminal tab management |
| `views/MemoryView.tsx` | 337 | Memory file browser |
| `main/db.ts` | 332 | Database schema + migrations |
