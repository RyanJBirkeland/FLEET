# Dashboard UX Improvements — Phased Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systematically improve the Dashboard screen's usability across three phases: quick wins (readability + affordances), data freshness + missing signals, and layout + density improvements.

**Architecture:** All changes are in the renderer process. Phases are independent — each produces a shippable PR. Phase 1 is pure CSS + component prop changes. Phase 2 adds a `lastFetchedAt` timestamp to the dashboard store and a Failed stat counter. Phase 3 restructures the grid layout for responsiveness and column-level scrolling.

**Tech Stack:** React, Zustand, CSS, vitest + @testing-library/react

**Spec:** Based on Dashboard UX audit findings (PM + Design audit, 2026-04-01)

---

## Phase 1: Quick Wins (readability, affordances, click targets)

_Estimated scope: 4 small tasks, one PR. Pure CSS changes + minor component tweaks._

### File Structure

| File                                                               | Action | Responsibility                               |
| ------------------------------------------------------------------ | ------ | -------------------------------------------- |
| `src/renderer/src/assets/dashboard-neon.css`                       | Modify | Fix font sizes, add StatCounter hover styles |
| `src/renderer/src/components/neon/ActivityFeed.tsx`                | Modify | Make feed events clickable                   |
| `src/renderer/src/components/neon/__tests__/ActivityFeed.test.tsx` | Modify | Test click handler                           |
| `src/renderer/src/views/DashboardView.tsx`                         | Modify | Wire feed event clicks to navigation         |

---

### Task 1: Fix illegible 9px text

**Files:**

- Modify: `src/renderer/src/assets/dashboard-neon.css`

- [ ] **Step 1: Update font sizes**

In `dashboard-neon.css`, change these three classes from 9px to 11px:

```css
/* was: font-size: 9px */
.dashboard-completion-time {
  font-size: 11px;
}

/* was: font-size: 9px */
.dashboard-chart-caption {
  font-size: 11px;
}

/* was: font-size: 9px */
.dashboard-ring__breakdown {
  font-size: 11px;
}
```

- [ ] **Step 2: Verify no tests break**

Run: `npx vitest run`
Expected: PASS (these are pure CSS changes)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/assets/dashboard-neon.css
git commit -m "fix: increase dashboard caption font sizes from 9px to 11px for readability"
```

---

### Task 2: Add hover affordance to StatCounters

**Files:**

- Modify: `src/renderer/src/assets/dashboard-neon.css`

The `StatCounter` component already supports `onClick`, `role="button"`, and `tabIndex` when clickable. It has a basic `opacity: 0.85` hover. But it lacks `cursor: pointer` and a visible glow effect to signal interactivity. The Dashboard's StatCounters all have `onClick` set.

- [ ] **Step 1: Add hover styles for clickable stat counters in dashboard context**

Add to `dashboard-neon.css`:

```css
/* ── StatCounter click affordances (Dashboard context) ── */
.dashboard-col .stat-counter[role='button'] {
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.dashboard-col .stat-counter[role='button']:hover {
  transform: translateY(-1px);
}

.dashboard-col .stat-counter[role='button']:active {
  transform: translateY(0);
}
```

Note: Check the actual CSS class name on the StatCounter component — it may be `.stat-counter` or something else. Read `StatCounter.tsx` to confirm the root element's className, and use that in the selector.

- [ ] **Step 2: Verify no tests break**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/assets/dashboard-neon.css
git commit -m "fix: add hover/active affordances to Dashboard StatCounters"
```

---

### Task 3: Make Activity Feed events clickable

**Files:**

- Modify: `src/renderer/src/components/neon/ActivityFeed.tsx`
- Modify or create: `src/renderer/src/components/neon/__tests__/ActivityFeed.test.tsx`

Currently `FeedEvent` has `{ id, label, accent, timestamp }` but no click handler. The Dashboard shows agent events (errors, completions) that users should be able to click to navigate to the relevant task or agent.

- [ ] **Step 1: Add `onEventClick` prop to ActivityFeed**

Read `ActivityFeed.tsx` first. Then add an optional `onEventClick` callback prop:

```typescript
interface ActivityFeedProps {
  events: FeedEvent[]
  maxItems?: number
  onEventClick?: (event: FeedEvent) => void // NEW
}
```

When `onEventClick` is provided, render each event row as a clickable element with `cursor: pointer`, `role="button"`, `tabIndex={0}`, and Enter/Space keyboard support. Add a subtle hover opacity change.

- [ ] **Step 2: Write test for click handler**

```typescript
it('calls onEventClick when an event is clicked', () => {
  const onClick = vi.fn()
  const events = [{ id: '1', label: 'Task completed', accent: 'cyan' as const, timestamp: Date.now() }]
  render(<ActivityFeed events={events} onEventClick={onClick} />)
  const eventRow = screen.getByText('Task completed').closest('[role="button"]')!
  fireEvent.click(eventRow)
  expect(onClick).toHaveBeenCalledWith(events[0])
})
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/renderer/src/components/neon/__tests__/ActivityFeed.test.tsx`
Expected: PASS

- [ ] **Step 4: Wire click in DashboardView**

In `DashboardView.tsx`, pass an `onEventClick` handler to `ActivityFeed` that navigates based on event type. For now, a simple navigation to the Agents view is sufficient:

```typescript
const handleFeedEventClick = useCallback(() => {
  setView('agents')
}, [setView])
```

Pass it: `<ActivityFeed events={feedEvents} onEventClick={handleFeedEventClick} />`

- [ ] **Step 5: Run full tests, commit**

Run: `npx vitest run`

```bash
git add src/renderer/src/components/neon/ActivityFeed.tsx src/renderer/src/components/neon/__tests__/ActivityFeed.test.tsx src/renderer/src/views/DashboardView.tsx
git commit -m "feat: make Dashboard activity feed events clickable"
```

---

### Task 4: Make Recent Completions rows clickable

**Files:**

- Modify: `src/renderer/src/views/DashboardView.tsx`
- Modify: `src/renderer/src/assets/dashboard-neon.css`

- [ ] **Step 1: Add click handler for completion rows**

In `DashboardView.tsx`, make each `.dashboard-completion-row` clickable. When clicked, if the task has a `pr_url`, open the PR station; otherwise navigate to the sprint view filtered to 'done'.

```typescript
const handleCompletionClick = useCallback(
  (task: SprintTask) => {
    if (task.pr_url) {
      setView('pr-station')
    } else {
      navigateToSprintWithFilter('done')
    }
  },
  [setView, navigateToSprintWithFilter]
)
```

Wrap each completion row in a clickable element with `role="button"`, `tabIndex={0}`, keyboard support, and call `handleCompletionClick(t)` on click.

- [ ] **Step 2: Add hover styles**

In `dashboard-neon.css`:

```css
.dashboard-completion-row[role='button'] {
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.dashboard-completion-row[role='button']:hover {
  background: var(--neon-surface-dim);
}
```

- [ ] **Step 3: Run tests, commit**

Run: `npx vitest run`

```bash
git add src/renderer/src/views/DashboardView.tsx src/renderer/src/assets/dashboard-neon.css
git commit -m "feat: make Dashboard completion rows clickable"
```

---

## Phase 2: Missing Signals (failed counter, last updated, stale warning)

_Estimated scope: 3 tasks, one PR. Adds failed task visibility and data freshness indicators._

### File Structure

| File                                         | Action | Responsibility                                      |
| -------------------------------------------- | ------ | --------------------------------------------------- |
| `src/renderer/src/views/DashboardView.tsx`   | Modify | Add Failed StatCounter, last-updated display        |
| `src/renderer/src/stores/dashboardData.ts`   | Modify | Track `lastFetchedAt` timestamp                     |
| `src/renderer/src/assets/dashboard-neon.css` | Modify | Styles for last-updated indicator and stale warning |

---

### Task 5: Add Failed/Error StatCounter

**Files:**

- Modify: `src/renderer/src/views/DashboardView.tsx`

- [ ] **Step 1: Add Failed counter to the left column**

In `DashboardView.tsx`, add a new `StatCounter` directly after the Blocked counter and before the PRs counter:

```tsx
<StatCounter
  label="Failed"
  value={stats.failed}
  accent="red"
  icon={<XCircle size={10} />}
  onClick={() => navigateToSprintWithFilter('failed')}
/>
```

Import `XCircle` from `lucide-react` (or use an appropriate icon — check what's already imported).

The `stats.failed` value already exists in the `stats` memo (line ~72-75 of DashboardView) — it counts tasks with status `failed`, `error`, or `cancelled`. It's just never been rendered.

- [ ] **Step 2: Verify it renders**

Run: `npx vitest run`
Expected: PASS (existing Dashboard tests should still pass)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/DashboardView.tsx
git commit -m "feat: add Failed/Error stat counter to Dashboard"
```

---

### Task 6: Track last-fetched timestamp in dashboard store

**Files:**

- Modify: `src/renderer/src/stores/dashboardData.ts`

- [ ] **Step 1: Add `lastFetchedAt` to the store state**

Read `dashboardData.ts`. Add a `lastFetchedAt: number | null` field to the state, initialized to `null`. At the end of `fetchAll()`, after all data has been fetched successfully, set `lastFetchedAt: Date.now()`.

```typescript
// In the store state:
lastFetchedAt: (null as number | null,
  // At the end of fetchAll(), after setting data:
  set({ lastFetchedAt: Date.now() }))
```

- [ ] **Step 2: Run tests, commit**

Run: `npx vitest run`

```bash
git add src/renderer/src/stores/dashboardData.ts
git commit -m "feat: track lastFetchedAt timestamp in dashboard data store"
```

---

### Task 7: Display "last updated" in StatusBar + stale warning

**Files:**

- Modify: `src/renderer/src/views/DashboardView.tsx`
- Modify: `src/renderer/src/assets/dashboard-neon.css`

- [ ] **Step 1: Add lastFetchedAt selector**

In `DashboardView.tsx`, add `lastFetchedAt` to the `useDashboardDataStore` selector:

```typescript
const { chartData, feedEvents, prCount, loading, cardErrors, lastFetchedAt } =
  useDashboardDataStore(
    useShallow((s) => ({
      chartData: s.chartData,
      feedEvents: s.feedEvents,
      prCount: s.prCount,
      loading: s.loading,
      cardErrors: s.cardErrors,
      lastFetchedAt: s.lastFetchedAt
    }))
  )
```

- [ ] **Step 2: Compute freshness state**

Add a memo that determines the display text and whether data is stale:

```typescript
const freshness = useMemo(() => {
  if (!lastFetchedAt) return { text: '', stale: false }
  const ago = Math.floor((Date.now() - lastFetchedAt) / 1000)
  const text = ago < 10 ? 'just now' : ago < 60 ? `${ago}s ago` : `${Math.floor(ago / 60)}m ago`
  // Stale if older than 2 polling intervals (120s)
  return { text, stale: ago > 120 }
}, [lastFetchedAt])
```

Note: This memo needs to re-evaluate periodically. Either use a small `useEffect` with a 10-second interval to force re-render, or accept that it updates on each poll (every 60s). A simple approach:

```typescript
const [, forceUpdate] = useState(0)
useEffect(() => {
  const interval = setInterval(() => forceUpdate((n) => n + 1), 10_000)
  return () => clearInterval(interval)
}, [])
```

- [ ] **Step 3: Update StatusBar children**

Replace the StatusBar children to include the freshness indicator:

```tsx
<StatusBar title="BDE Command Center" status={freshness.stale ? 'warning' : 'ok'}>
  {loading && !chartData.length ? (
    <span className="dashboard-status-loading">Loading...</span>
  ) : Object.values(cardErrors).filter(Boolean).length > 0 ? (
    <span className="dashboard-status-error" style={{ color: neonVar('red', 'color') }}>
      {Object.values(cardErrors).filter(Boolean).length} card
      {Object.values(cardErrors).filter(Boolean).length !== 1 ? 's' : ''} failed
    </span>
  ) : (
    <span className="dashboard-status-ok">
      SYS.OK
      {freshness.text && (
        <span
          className={`dashboard-status-freshness ${freshness.stale ? 'dashboard-status-freshness--stale' : ''}`}
        >
          {' · '}
          {freshness.text}
        </span>
      )}
    </span>
  )}
</StatusBar>
```

- [ ] **Step 4: Add CSS for freshness indicator**

In `dashboard-neon.css`:

```css
.dashboard-status-ok {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dashboard-status-freshness {
  color: var(--neon-text-dim);
  font-size: 10px;
  opacity: 0.6;
}

.dashboard-status-freshness--stale {
  color: var(--neon-orange);
  opacity: 1;
}
```

- [ ] **Step 5: Run tests, commit**

Run: `npx vitest run`

```bash
git add src/renderer/src/views/DashboardView.tsx src/renderer/src/assets/dashboard-neon.css
git commit -m "feat: show last-updated timestamp in Dashboard StatusBar with stale warning"
```

---

## Phase 3: Layout & Density (responsive grid, scroll, hierarchy)

_Estimated scope: 4 tasks, one PR. Structural layout changes._

### File Structure

| File                                         | Action | Responsibility                                                |
| -------------------------------------------- | ------ | ------------------------------------------------------------- |
| `src/renderer/src/assets/dashboard-neon.css` | Modify | Responsive breakpoints, column-level scroll, visual hierarchy |
| `src/renderer/src/views/DashboardView.tsx`   | Modify | Restructure cost cards, consolidate stats                     |

---

### Task 8: Column-level scrolling

**Files:**

- Modify: `src/renderer/src/assets/dashboard-neon.css`

- [ ] **Step 1: Switch from grid scroll to column scroll**

Currently `.dashboard-grid` has `overflow: auto` which scrolls the whole grid. Change to per-column scrolling:

```css
.dashboard-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 200px 1fr 240px;
  gap: 12px;
  padding: 12px;
  overflow: hidden; /* was: auto */
  min-height: 0; /* allow flex shrink */
}

.dashboard-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  min-height: 0;
}
```

Also increase the feed scroll max-height or remove it (the column itself now scrolls):

```css
.dashboard-feed-scroll {
  overflow: auto;
  /* Remove max-height: 240px — column handles overflow now */
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 2: Run tests, commit**

Run: `npx vitest run`

```bash
git add src/renderer/src/assets/dashboard-neon.css
git commit -m "fix: switch Dashboard to column-level scrolling"
```

---

### Task 9: Add responsive breakpoints

**Files:**

- Modify: `src/renderer/src/assets/dashboard-neon.css`

- [ ] **Step 1: Add responsive grid rules**

Add breakpoints for narrower Electron windows:

```css
/* Collapse to 2 columns at narrow widths */
@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: 180px 1fr;
  }
  /* Right column moves below center */
  .dashboard-col:nth-child(3) {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 12px;
  }
}

/* Single column for very narrow */
@media (max-width: 600px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Run tests, commit**

Run: `npx vitest run`

```bash
git add src/renderer/src/assets/dashboard-neon.css
git commit -m "fix: add responsive breakpoints to Dashboard grid"
```

---

### Task 10: Demote one cost surface, rebalance hierarchy

**Files:**

- Modify: `src/renderer/src/views/DashboardView.tsx`
- Modify: `src/renderer/src/assets/dashboard-neon.css`

The audit found cost appears 3 times (Cost/Run chart, Cost 24h card, cost trend data) while failures appeared 0 times (now fixed by Task 5). The Cost/Run chart in the center column is the least actionable — move it to the right column and shrink it, freeing center column space for the Pipeline (the hero element).

- [ ] **Step 1: Move Cost/Run card from center to right column**

In `DashboardView.tsx`, move the `<NeonCard accent="orange" title="Cost / Run">` block from the center column to the right column, placing it between "Recent Completions" and "Cost 24h". This consolidates all cost info in the right column.

- [ ] **Step 2: Adjust center column spacing**

With the Cost/Run card removed from center, the Pipeline card gets more visual prominence as the "hero" element. No code change needed — the flex layout will automatically give the remaining cards more space.

- [ ] **Step 3: Run tests, commit**

Run: `npx vitest run`

```bash
git add src/renderer/src/views/DashboardView.tsx
git commit -m "fix: consolidate cost cards in right column, promote Pipeline as hero"
```

---

### Task 11: Remove ScanlineOverlay from Dashboard

**Files:**

- Modify: `src/renderer/src/views/DashboardView.tsx`

The audit found ScanlineOverlay adds visual noise on the data-dense Dashboard. It works for splash screens but hurts readability here.

- [ ] **Step 1: Remove ScanlineOverlay render**

In `DashboardView.tsx`, remove the line:

```tsx
{
  !reduced && <ScanlineOverlay />
}
```

Keep `ParticleField` (it's subtle enough). Also remove `ScanlineOverlay` from the imports if it's no longer used elsewhere in this file.

- [ ] **Step 2: Run tests, commit**

Run: `npx vitest run`

```bash
git add src/renderer/src/views/DashboardView.tsx
git commit -m "fix: remove ScanlineOverlay from Dashboard for readability"
```

---

## Phase Summary

| Phase                         | Tasks      | Scope                             | Key Outcomes                                                    |
| ----------------------------- | ---------- | --------------------------------- | --------------------------------------------------------------- |
| **Phase 1: Quick Wins**       | Tasks 1-4  | CSS + minor component changes     | Readable text, clickable everything, hover affordances          |
| **Phase 2: Missing Signals**  | Tasks 5-7  | Store + view changes              | Failed counter visible, data freshness indicator, stale warning |
| **Phase 3: Layout & Density** | Tasks 8-11 | Structural CSS + view restructure | Responsive grid, column scroll, visual hierarchy, less noise    |

Each phase is a separate PR. Phases can be executed independently and in any order, though Phase 1 → 2 → 3 is recommended (cheapest fixes first, structural changes last).
