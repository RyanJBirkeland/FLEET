# Architecture Decision: costData and agentHistory Store Separation

## Status
Accepted

## Context
The audit synthesis (P3-37, Specialist C DS1) flagged potential duplication between `costData` and `agentHistory` stores, noting that both fetch agent run data.

## Investigation
Both stores query the same `agent_runs` SQLite table, but serve fundamentally different purposes:

### costData Store
**Purpose:** Cost tracking and metrics for Dashboard
**Returns:** `AgentCostRecord[]` (via `cost:getAgentHistory` IPC)
**Query:** `WHERE finished_at IS NOT NULL`
**Unique fields:** `durationMs`, `numTurns`, `cacheRead`, `cacheCreate`, `taskTitle`, `prUrl`
**Used by:** Dashboard metrics, cost charts, billing summaries

### agentHistory Store
**Purpose:** Runtime agent monitoring for Agents view
**Returns:** `AgentMeta[]` (via `agents:list` IPC)
**Query:** Optional `WHERE status = ?`
**Unique fields:** `pid`, `bin`, `status`, `logPath`, `source`, `exitCode`, `repoPath`
**Used by:** Agents view, log streaming, session management

### Field Overlap
Only 8 shared fields: `id`, `model`, `startedAt`, `finishedAt`, `costUsd`, `tokensIn`, `tokensOut`, `repo`

These shared fields are used in completely different UI contexts and serve different analytical needs.

## Decision
**Do NOT consolidate these stores.** Maintain them as separate, domain-specific stores.

## Rationale
1. **Different data shapes:** Each store contains 8+ fields the other doesn't need
2. **Different filters:** One filters by completion, the other by status
3. **Different concerns:** Cost tracking vs runtime monitoring are separate domains
4. **Single Responsibility:** Each store serves a single, focused purpose
5. **No performance gain:** Both are paginated queries with different access patterns
6. **Increased complexity:** Consolidation would mix concerns and complicate component interfaces

## Consequences
- Two stores continue to exist for agent run data
- Documentation added to both stores explaining the intentional separation
- Components remain focused on their specific data needs
- No duplicate network requests (different polling intervals, different filters)

## References
- `src/renderer/src/stores/costData.ts` — cost tracking store
- `src/renderer/src/stores/agentHistory.ts` — runtime monitoring store
- `src/main/data/cost-queries.ts` — cost-specific database queries
- `src/main/data/agent-queries.ts` — runtime-specific database queries
