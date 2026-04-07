# Dashboard Charts Redesign

**Status:** Draft
**Date:** 2026-04-07
**Scope:** `src/renderer/src/views/DashboardView.tsx` and `src/renderer/src/components/dashboard/*`, plus a small SQL change in `src/main/handlers/dashboard-handlers.ts`.

## Problem

The dashboard is trying to show useful information but the presentation makes it impossible to read. Every chart uses the same primitive (`MiniChart`) — a decorative sparkline with no axes, no gridlines, no tick labels — stretched to 120px tall as if it were a hero chart. Specific failures:

- **Success Trend** auto-scales its Y-axis from 0 to `max(data)`, so when every day is 95–100% a single 80% day produces wild visual swings. No "100%" reference line. No tick labels. The chart encodes no actionable information.
- **Sprint Burn-Down** is mislabeled — it shows tasks-completed-per-day (a run-up), not remaining work sloping toward zero. Users interpret the curve as a burndown because of the title, and get misled.
- **Completions by Hour** has no hour axis. When most hours have zero completions (the common case), the chart shows one lonely dot and looks broken.
- **Success Rate donut** is decoration. At 100% it's a full circle; at 98% it's still visually "full"; at any value below that it still tells you nothing about *when* or *why*.
- **Avg Task Duration** card shows `—` and "0 runs tracked" despite 115 done tasks — the data pipeline is wrong and a blank hero card trains users to ignore the dashboard.
- **Left column status rail** stacks 8 separate cards vertically, most showing 0 in steady state. Huge real estate to communicate "4 things are happening."

## Goals

The dashboard must answer five questions within ~2 seconds of opening, ordered by priority:

1. **Is anything on fire right now?** — failed / blocked / stuck tasks
2. **How fast is the system going?** — completions per hour, current rate vs normal
3. **Is the success rate healthy?** — % and trend
4. **How much is this costing?** — token burn and trend
5. **What just happened?** — recent activity

Non-goals (explicitly dropped from scope):

- "What's waiting on me" (Code Review has its own view)
- "Am I getting faster over time" (avg duration card)
- "Which spec types succeed" (moved out of dashboard; can live in Settings/Analytics later)

## Design Overview

Preserves the current three-column structure (left rail / center charts / right activity) so the mental model stays intact. Surgical fixes to each chart; two primitives removed; one new primitive added.

```
+-----------------------------------------------------------------------+
| STATUS BAR (unchanged)                                                |
+-----------------------------------------------------------------------+
| [!] ATTENTION  2 failed · 3 blocked · 1 stuck >1h          click →    |  <-- collapses when empty
+--------+----------------------------------------+---------------------+
| ACTIVE |  THROUGHPUT · last 24h                 | RECENT COMPLETIONS  |
|   6    |  [bar chart, hour axis, y-axis]        |  task... 57m        |
+--------+                                        |  task... 1h         |
| QUEUED |                                        |  task... 1h         |
|   0    |                                        |                     |
+--------+----------------------------------------+---------------------+
| DONE   |  SUCCESS RATE · last 14d               | LIVE ACTIVITY       |
| 115    |  [line chart, fixed 0-100% y-axis]     |  → task started 2m  |
| 4 today|                                        |  ✓ task done 5m     |
+--------+                                        |  ✗ task failed 8m   |
| TOKENS |                                        |  ✓ task done 12m    |
|  628K  |                                        |                     |
+--------+----------------------------------------+                     |
| + NEW  |  TOKENS / RUN  ~32K  [sparkline]       |                     |
+--------+----------------------------------------+---------------------+
```

### 1. Fires strip (new)

Renders at the top of the grid when any of the following are non-zero: `stats.failed`, `stats.blocked`, or `stuckCount`. Collapses entirely (no DOM, no space) when everything is zero.

- **Shape:** single horizontal card with red accent, three text segments separated by dots, e.g. `⚠ ATTENTION — 2 failed · 3 blocked · 1 stuck >1h`.
- **Interactions:** entire card is a button; clicking routes to Sprint Pipeline with status filter = failed (or blocked, or active+stuck). If multiple categories are present, clicking jumps to failed first; segment-level click targets are a future enhancement if desired.
- **"Stuck" definition:** a task in `active` status whose `(now - started_at)` exceeds `max_runtime_ms` (falling back to the global watchdog default, currently 1h). Matches how the agent manager already thinks about stuck tasks — no new concept.
- **Data source:** derived in `useDashboardMetrics` from the existing `tasks` array. `started_at` is already present on sprint tasks; `max_runtime_ms` is an existing optional column.
- **Replaces:** the current `NeonCard accent="red" title="Attention"` block in `CenterColumn.tsx` which was a mix of three separate buttons. Consolidated into the strip. Also replaces the `FailureBreakdown` card in the right column (now redundant).

### 2. Compressed status rail

Reduces the left column from 8 stacked cards to 5 compact tiles, plus the existing "+ New Task" button.

| Tile | Value | Subtext | Click action |
|---|---|---|---|
| Active | `stats.active` | — | filter → active |
| Queued | `stats.queued` | — | filter → queued |
| Done | `stats.done` | `{doneToday} today` | filter → done |
| Tokens 24h | `formatTokensCompact(tokens24h)` | — | (no-op, informational) |
| + New Task | — | — | open Task Workbench |

The tiles are ~90px wide, 2/3 the height of the current cards. The four statuses **not** in the rail (Blocked, Failed, Review, PRs) are handled by:

- **Blocked / Failed** → Fires strip (only shown when > 0)
- **Review / PRs** → already accessible via the Sprint Pipeline and Code Review views; not top-5 per the goals

No new "Failed: 0" or "PRs: 0" cards cluttering the rail in steady state.

### 3. Throughput chart (hero, replaces "Completions by Hour")

A proper bar chart with axes, replacing the sparkline.

- **X-axis:** 24 hour buckets from `(now - 24h)` to `now`. Tick labels at 12am / 6am / noon / 6pm / now. The hour labels derive from local time using the existing `hour` ISO string from `getCompletionsPerHour`.
- **Y-axis:** auto-scaled with 0 and a max rounded up to a "nice" number (5, 10, 20, 50, 100). Three gridlines (0, mid, max) with tick labels at the left edge.
- **Bars:** one bar per hour, 24 total. Stacked **success** (cyan) on bottom, **failed** (red) on top. Missing hours render as an empty slot (gap), not a zero bar — empty and "genuinely zero at noon" look different.
- **Header numbers:** `{lastHourCount}` (big), caption `last hour`, plus `{avgPerHour}/hr avg · peak {peak} @ {peakHour}` aligned right.
- **Empty state:** when all 24 hours are zero, show `"No completions in the last 24h"` centered in the chart body instead of an empty axis.
- **Hover:** existing tooltip behavior from `MiniChart` hover, but showing `"{hour}: {success} done, {failed} failed"`.

**Data change required:** `getCompletionsPerHour` in `src/main/handlers/dashboard-handlers.ts` currently returns `{hour, count}`. Must be changed to return `{hour, successCount, failedCount}` by splitting on `agent_runs.status`:

```sql
SELECT
  strftime('%Y-%m-%dT%H:00:00', finished_at / 1000, 'unixepoch', 'localtime') AS hour,
  SUM(CASE WHEN status = 'done'   THEN 1 ELSE 0 END) AS successCount,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedCount
FROM agent_runs
WHERE finished_at IS NOT NULL
  AND finished_at > (strftime('%s', 'now', '-24 hours') * 1000)
GROUP BY hour
ORDER BY hour ASC
```

IPC channel type in `src/shared/ipc-channels.ts` must be updated. Existing tests for `getCompletionsPerHour` must be updated to the new shape.

### 4. Success Rate Trend (hero, replaces "Success Trend" + removes the donut)

A line chart with a **fixed** Y-axis.

- **Y-axis:** hard-coded `[0, 100]`. Tick labels at 0%, 75%, 90%, 100%. Gridlines at 75% and 100%. This is the single most important fix in the design — no auto-scaling allowed on a percentage chart.
- **X-axis:** 14 day buckets with real date labels at the endpoints and midpoint (e.g. `Mar 25` / `Mar 30` / `Apr 4` / `today`).
- **Line:** green line with dots per data point, gradient fill below. Days with `successRate == null` (no data) render as a **gap** in the line — the line picks back up on the next data point. The current implementation coerces null → 0 which creates misleading plunges.
- **Header numbers:** `{7dAverage}%` (big, green), caption `7d avg`, plus `▲ +{delta}% vs prior wk` right-aligned, colored green for positive / red for negative / dim for flat. The 7d average and prior-week delta are computed from `successTrendData` in `useDashboardMetrics`.
- **Empty state:** when all 14 days are null, show `"No completed tasks in the last 14 days"`.

**No data change required** — `getDailySuccessRate(14)` already returns the right shape.

**Removes:** the `SuccessRing` donut entirely. The new trend card encodes current value (the big number) and the trend, making the donut redundant.

### 5. Tokens / Run (secondary)

Kept as a small row beneath the two hero charts. This is the **only** place a raw sparkline without axes is appropriate, because it sits inline next to a number.

- One row card, ~50px tall.
- Left: `💰 Tokens / run` title, `{tokenAvg}` as the value, caption `last 20 runs`.
- Right: 80×24px inline sparkline using the existing `tokenTrendData`.
- No axes, no tick labels. It's a sparkline doing a sparkline's actual job.

### 6. Right column (activity)

Largely unchanged in function, mildly restyled for consistency.

- **Recent Completions** card — same as today, no changes.
- **Live Activity** card — same as today, no changes.
- The existing `FailureBreakdown` card is removed; its role is taken over by the Fires strip.

## Components Removed

- `ChartsSection` is significantly simplified; may be replaced entirely by inlining the two new chart components.
- `SuccessRing` — deleted (donut gone).
- `SpecTypeSuccessRate` — moved out of the dashboard view. File can remain in `components/dashboard/` if a future analytics view wants to reuse it, or be deleted now. **Recommendation:** delete, reintroduce if/when an analytics view is built.
- `FailureBreakdown` — deleted (replaced by Fires strip).
- "Sprint Burn-Down" card — deleted. `burndownData`, `getTaskBurndown`, and the `sprint:burndown` IPC channel can be removed from `dashboardData.ts`, `dashboard-handlers.ts`, and `ipc-channels.ts` respectively. This removes dead code, not just UI.
- "Avg Task Duration" card — deleted. The `avgDuration` / `avgTaskDuration` calculations in `useDashboardMetrics` can stay (they're cheap) in case a future view wants them, but the card and its props are removed from `CenterColumn`/`ChartsSection`.

## Components Added

### `FiresStrip`

```tsx
interface FiresStripProps {
  failed: number
  blocked: number
  stuck: number
  onClick: (kind: 'failed' | 'blocked' | 'stuck') => void
}
```

Renders nothing when all three are 0. Otherwise a single horizontal NeonCard with red accent.

### `ThroughputChart`

```tsx
interface ThroughputDatum {
  hour: string       // ISO local hour, e.g. "2026-04-07T14:00:00"
  successCount: number
  failedCount: number
}
interface ThroughputChartProps {
  data: ThroughputDatum[]
  height?: number    // default 140
}
```

A new SVG chart component. Not an extension of `MiniChart` — it's architecturally a different thing (bars, stacked, real axes, real labels). Lives in `components/dashboard/ThroughputChart.tsx`.

### `SuccessRateChart`

```tsx
interface SuccessRateChartProps {
  data: DailySuccessRate[]  // existing type
  height?: number            // default 140
}
```

Replaces `SuccessTrendChart`. Renders a line chart with fixed `[0,100]` Y-axis, tick labels, gridlines at 75/100, gaps for null days, and computes + renders the 7d avg + week-over-week delta header internally. Lives in `components/dashboard/SuccessRateChart.tsx`.

### `StatusRail`

```tsx
interface StatusRailProps {
  stats: DashboardStats
  tokens24h: number
  onFilterClick: (filter: StatusFilter) => void
  onNewTaskClick: () => void
}
```

Replaces `StatusCounters`. Renders 5 compact tiles + New Task button. Lives in `components/dashboard/StatusRail.tsx`. `StatusCounters.tsx` can be deleted.

## Data Flow

```
[DashboardView]
  │
  ├── useSprintTasks ───┐
  ├── useCostData ──────┤
  ├── useDashboardData ─┴─► useDashboardMetrics (extended)
  │                          │
  │                          ├── stats + stuck count       → FiresStrip
  │                          ├── stats + tokens24h         → StatusRail
  │                          ├── throughputData (new)      → ThroughputChart
  │                          ├── successTrendData           → SuccessRateChart
  │                          ├── tokenTrendData             → TokensPerRun
  │                          └── recentCompletions, feed    → ActivitySection
```

### Extensions to `useDashboardMetrics`

- Add `stuckCount`: `tasks.filter(t => t.status === 'active' && t.started_at && (now - Date.parse(t.started_at)) > (t.max_runtime_ms ?? DEFAULT_STUCK_MS)).length`
- Add `throughputData: ThroughputDatum[]` derived from the new `chartData` shape returned by the updated IPC handler.
- Add `successRate7dAvg` and `successRateWeekDelta` computed from `successTrendData`.
- Drop `avgDuration`, `avgTaskDuration`, `taskDurationCount` from the return type (or leave in place unused — recommend dropping for clarity).

### Extensions to `useDashboardDataStore`

- Update `chartData` type from `ChartBar[]` to `ThroughputDatum[]`.
- Remove `burndownData` and its fetch logic entirely.
- Remove the `burndown` error key.

## Error Handling

Per-card error pattern stays the same (`cardErrors[key]` + retry button). New keys:

- `throughput` (replaces `chart`)
- `successRate` (replaces `successTrend`)
- `burndown` key removed

## Testing Strategy

Existing tests to update:

- `CenterColumn.test.tsx`, `ChartsSection.test.tsx`, `StatusCounters.test.tsx` — rewrite against the new component tree.
- `SuccessTrendChart.test.tsx` — rename and rewrite for `SuccessRateChart`, add explicit test for fixed `[0,100]` Y-axis (snapshot an 80%–100% dataset and assert the rendered SVG coordinates are not clamped to full-height).
- `MorningBriefing.test.tsx`, `ActivitySection.test.tsx` — likely unchanged.
- `dashboard-handlers.test.ts` — update for new `getCompletionsPerHour` shape; remove `getTaskBurndown` test.

New tests:

- `ThroughputChart.test.tsx` — renders 24 bars, stacks success+failed, shows empty state when all zero, hour labels visible.
- `FiresStrip.test.tsx` — renders nothing when all zero, renders each non-zero category, click routes correctly.
- `StatusRail.test.tsx` — 5 tiles, tokens24h formatting, click-to-filter.
- `useDashboardMetrics.test.ts` — stuck detection respects `max_runtime_ms` when set, falls back to default when unset; week-over-week delta math.

Coverage targets: match or exceed existing `components/dashboard/` coverage. No new coverage thresholds.

## Migration / Rollout

Single PR. No feature flag. The dashboard is the default view, so breakage is immediately visible in dev. Screenshots of the new dashboard go in the PR body per the UX PR rule.

No database migration. No settings changes. Existing in-flight tasks unaffected.

## Open Questions

- **"Stuck" default threshold:** when a task has no `max_runtime_ms` set, how long before we flag it as stuck? Proposing **1 hour** to match the agent-manager watchdog default. Overridable per-task via existing field.
- **Throughput Y-axis max at peak:** propose rounding to next "nice" number above the peak (5/10/20/50/100). Floor max = 5 so single-digit peaks still look like bars rather than full-height rectangles.

## Non-Goals (explicit)

- No real-time websocket updates. Polling (existing 60s interval) stays.
- No drill-down into individual hour/day (future feature).
- No per-repo or per-branch filtering (future feature).
- No export / copy-to-clipboard of chart data.
- No revival of the duration card until its data pipeline is fixed.
