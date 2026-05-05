# V2 Dashboard Phase 2.5 Design

**Date:** 2026-05-05
**Scope:** Quality scores (DB write-back) + agent step descriptions (live event threading)

## Problem

Four `TODO(phase-2.5)` stubs in the V2 Dashboard render dead UI:

1. `QualityChip` in `RecentCompletionsCard`, `PerAgentStats` — always receives `null`
2. `ActiveAgentsCard` step description — hardcoded `"$ running…"` for every active agent

Root causes: (a) `quality_score` from the `task_reviews` table is never written back to `sprint_tasks`, so the dashboard can't read it. (b) `useDashboardData` never consults `sprintEvents`, so live agent step data is ignored.

Out of scope: `ReviewQueueCard` `+add/−del` diff stats (requires per-task git diff on every poll — too expensive). `MissionBriefBand` sprint data (no sprint IPC to improve against).

---

## Piece 1 — Quality Scores

### Migration (`v062`)

Add a nullable `quality_score` column to `sprint_tasks`:

```sql
ALTER TABLE sprint_tasks ADD COLUMN quality_score INTEGER;
```

No backfill. Existing tasks get `NULL`; `QualityChip` already renders nothing for `null`.

### Type (`src/shared/types/task-types.ts`)

Add to `SprintTask`:

```ts
quality_score?: number
```

Pick it up in `mapRowToTask` in `src/main/data/sprint-task-mapper.ts`:

```ts
quality_score: typeof row.quality_score === 'number' ? row.quality_score : undefined,
```

### Write-back (`src/main/services/review-service.ts`)

After `reviewRepository.setCached(taskId, commitSha, result, raw)`, add:

```ts
await updateTask(taskId, { quality_score: result.qualityScore })
```

`review-service.ts` already has access to the task update path. One line, one location. Only fires on successful structured reviews (the `qualityScore` is validated 0–100 before reaching this point).

### Dashboard (`src/renderer/src/components/dashboard/hooks/useDashboardData.ts`)

`sprintTasks` already flows through `useDashboardData`. Replace `quality: null` with `quality: task.quality_score ?? null` in both `derivePerAgentStats` and the active-agent derivation. Remove the four `TODO(phase-2.5)` comments for quality.

---

## Piece 2 — Agent Step Descriptions

### Pure utility (`src/renderer/src/lib/describeAgentStep.ts`)

```ts
export function describeAgentStep(event: AgentEvent | undefined): string
```

Rules:
- `undefined` → `"running…"`
- `agent:tool_call` → `"$ <tool>: <summary>"` truncated to 52 chars with `"…"`
- `agent:text` → first non-empty line, truncated to 52 chars with `"…"`
- anything else → `"running…"`

Exported as a pure function — easy to unit test, zero side effects.

### `ActiveAgent` type (`useDashboardData.ts`)

Add `stepDescription: string` to the `ActiveAgent` interface.

### `useDashboardData` hook

Subscribe to `useSprintEvents` and call `selectLatestEvent(taskId)` for each active agent when deriving the `agents` array:

```ts
const latestEvent = useSprintEvents(selectLatestEvent(task.id))
// …
stepDescription: describeAgentStep(latestEvent)
```

Note: `useSprintEvents` is already initialized at app start (`initTaskOutputListener`), so no new subscription setup is needed.

### `ActiveAgentsCard`

Replace hardcoded `"$ running…"` with `{agent.stepDescription}`.

---

## Files Changed

| File | Change |
|---|---|
| `src/main/migrations/v062-add-quality-score-to-sprint-tasks.ts` | New migration |
| `src/shared/types/task-types.ts` | Add `quality_score?: number` to `SprintTask` |
| `src/main/data/sprint-task-mapper.ts` | Pick up `quality_score` in `mapRowToTask` |
| `src/main/services/review-service.ts` | Write back `quality_score` after `setCached` |
| `src/renderer/src/lib/describeAgentStep.ts` | New pure utility |
| `src/renderer/src/components/dashboard/hooks/useDashboardData.ts` | Thread quality + step descriptions |
| `src/renderer/src/components/dashboard/LiveColumn/ActiveAgentsCard.tsx` | Use `stepDescription` |
| `src/renderer/src/components/dashboard/TriageColumn/RecentCompletionsCard.tsx` | Pass real quality score |
| `src/renderer/src/components/dashboard/StatsAccordion/PerAgentStats.tsx` | Pass real quality score |

## Tests

- `describeAgentStep.test.ts` — unit test each event type + truncation + undefined
- `v062.test.ts` — migration smoke test (modeled on `v049.test.ts`)
- `useDashboardData` — existing tests should pass; update fixtures to include `quality_score`

## Non-goals

- ReviewQueueCard `+add/−del` stats — deferred (git diff per task on poll is too expensive)
- MissionBriefBand sprint progress improvements — no sprint IPC to improve against
- Quality score history / trending — out of scope for this phase
