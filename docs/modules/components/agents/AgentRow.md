# AgentRow

**Layer:** renderer/components
**Source:** `src/renderer/src/components/agents/AgentRow.tsx`

## Purpose
V2 list row for the FleetList sidebar. Three-line layout: status indicator (pulse when running, dot when terminal) + agent id + age; repo prefix + current step; running-only progress bar.

## Public API
- `AgentRow({ agent, selected, onClick, currentStep?, progressPct? })` — pure presentational

## Key Dependencies
- `timeAgo` from `lib/format.ts`
