# Fleet at a Glance — empty state

## Problem

Today, when a user opens the Agents view with no agent selected (and no spawn modal active), the cockpit pane shows a passive `<EmptyState title="No agent selected" description="Select an agent from the fleet list to view its console output." />`. This is wasted real estate — the user is staring at "select something" when they could be looking at fleet-level signal: how many agents are running, what they're doing right now, what just completed.

## Solution

Replace the empty-state `EmptyState` with a new `FleetGlance` component that renders three sections using **only existing data** from the `agentHistory` and `agentEvents` Zustand stores:

1. **Fleet status row** — counts derived from the `agents` array: running / done / failed (today). Plus today's total cost ($X.XX) and total runtime (Nm). Use lucide icons (`Loader`, `CheckCircle`, `XCircle`, `DollarSign`, `Clock`).
2. **What's happening now** — for each running agent (max 5), render: status dot + task title (truncated 60 chars) + a one-line "running" hint (just `▶ running` for now; live activity description is deferred per spec Open Question #1) + duration + cost. Click → calls the same `onSelect` callback the sidebar uses.
3. **Recent completions** — last 5 done/failed agents from the `agents` array, sorted by `finishedAt` descending. Each row: status icon + task title + duration + cost + relative time (e.g., `6m ago`).

Render at the same DOM location where `EmptyState` currently renders in `AgentsView.tsx` (lines 436-449). Use the existing neon card styling — `NeonCard` primitive or matching `.fleet-glance__section` class with the same border/background tokens as existing cards.

**Subscriptions:** `useAgentHistoryStore((s) => s.agents)` for status counts and recent completions. No subscription to `agentEvents` is needed for this minimal version (the live activity description is deferred).

**Selection callback:** `FleetGlance` accepts `onSelect: (id: string) => void` from `AgentsView` so clicking a "what's happening now" row selects the agent in the sidebar (existing flow).

## Files to Change

- NEW: `src/renderer/src/components/agents/FleetGlance.tsx` (~120 LOC)
- NEW: `src/renderer/src/components/agents/FleetGlance.css`
- MODIFY: `src/renderer/src/views/AgentsView.tsx` (replace `EmptyState` with `<FleetGlance onSelect={handleSelectAgent} />`)

## How to Test

1. **`FleetGlance` exists and is wired:**
   ```bash
   ls src/renderer/src/components/agents/FleetGlance.tsx src/renderer/src/components/agents/FleetGlance.css
   grep -n 'FleetGlance' src/renderer/src/views/AgentsView.tsx
   ```
   Expected: both files exist; AgentsView imports and renders `FleetGlance`.
2. **No reference to the deleted EmptyState in the empty branch:**
   ```bash
   grep -n 'No agent selected' src/renderer/src/views/AgentsView.tsx
   ```
   Expected: 0 matches (the old empty-state copy is gone).
3. **No new IPC, no new store fields:**
   ```bash
   git diff main -- src/preload/index.ts src/shared/ipc-channels.ts src/renderer/src/stores/agentHistory.ts src/renderer/src/stores/agentEvents.ts
   ```
   Expected: empty diff.
4. **Tests pass:**
   ```bash
   npm run typecheck && npm test && npm run lint
   ```
   Add a `FleetGlance.test.tsx` that mounts the component with mock agents (3 running, 2 done, 1 failed) and asserts the status counts, the running list, and the recent completions list.
5. **Manual smoke test:** open Agents view with at least 1 running and 2-3 done agents — verify the panel renders with correct counts and clicking a "what's happening now" row selects that agent in the sidebar.

## Out of Scope

- Live activity description per running agent (deferred per spec Open Question #1)
- Subscribing to `agentEvents` (not needed for the minimal version)
- New IPC channels or new fields on `AgentMeta`
- Refactoring `EmptyState` itself (just don't use it in this empty branch)
- Sidebar / fleet (task 02)
- Header (task 03)
- Card grammar (tasks 05, 06)
- Inline-styles cleanup (task 01) — DO NOT touch the inline-style refactor done by task 01
