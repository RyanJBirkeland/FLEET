# AgentInspector

**Layer:** renderer/components
**Source:** `src/renderer/src/components/agents/AgentInspector.tsx`

## Purpose
Six-section read-only pane shown in Console mode alongside the agent console. Displays task prompt, task spec path, worktree info, files touched, run metrics, and a recent event timeline.

## Public API
- `AgentInspector({ agent, events })` — `agent: AgentMeta`, `events: AgentEvent[]`

## Key Dependencies
- `MiniStat` from `components/sprint/primitives/MiniStat.tsx` — 2×2 metric tile grid
- `MicroSpark` from `components/dashboard/primitives/MicroSpark.tsx` — token sparkline
