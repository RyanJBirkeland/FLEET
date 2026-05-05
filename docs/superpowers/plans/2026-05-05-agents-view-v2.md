# Agents View V2 (Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Agents view from V1 neon chrome to the V2 token vocabulary and add an Inspector pane (3rd pane) that shows task prompt, spec, worktree, files, metrics, and timeline for the selected agent.

**Architecture:** Feature-flag the V2 view (`v2Agents`) so V1 runs by default and V2 is opt-in (same pattern as `v2Dashboard`, `v2Pipeline`). `AgentsViewV2` becomes a three-pane flex layout (FleetList 320px · Center 1fr · Inspector 320px); the Inspector only appears in Console mode. All stores and hooks are unchanged — this is a chrome refactor + new Inspector.

**Tech Stack:** React 18, TypeScript strict, CSS custom properties (V2 token vocab in `src/renderer/src/assets/tokens.css`), vitest + React Testing Library. Key primitives: `MiniStat` from `components/sprint/primitives/MiniStat.tsx`, `MicroSpark` from `components/dashboard/primitives/MicroSpark.tsx`.

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Add flag | `src/renderer/src/stores/featureFlags.ts` | `v2Agents` bool |
| Rename | `AgentsView.tsx` → `AgentsViewV1.tsx`, CSS → `AgentsViewV1.css` | V1 frozen |
| Create | `src/renderer/src/views/AgentsView.tsx` | Thin dispatcher (V1/V2) |
| Create | `src/renderer/src/views/AgentsViewV2.tsx` | Three-pane orchestrator |
| Extract | `src/renderer/src/components/agents/ScratchpadBanner.tsx` | Dismissable banner |
| Create | `src/renderer/src/components/agents/AgentRow.tsx` | V2 list row |
| Modify | `src/renderer/src/components/agents/AgentList.tsx` | Banded layout, filter chips, composition strip |
| Shrink | `src/renderer/src/components/agents/AgentList.css` | Token-driven |
| Rename | `ConsoleHeader.tsx` → `AgentConsoleHeader.tsx`, CSS too | V2 48px header |
| Create | `src/renderer/src/components/agents/AgentConsoleStream.tsx` | Stream + virtualizer |
| Create | `src/renderer/src/components/agents/AgentComposer.tsx` | V2 composer |
| Modify | `src/renderer/src/components/agents/AgentConsole.tsx` | Assemble sub-components |
| Shrink | `src/renderer/src/components/agents/AgentConsole.css` | Token-driven |
| Create | `src/renderer/src/components/agents/AgentInspector.tsx` | Six sections |
| Create | `src/renderer/src/components/agents/AgentInspector.css` | Minimal |
| Modify | `src/renderer/src/components/agents/AgentLaunchpad.tsx` | Center-column form + two fields |
| Modify | `src/renderer/src/components/agents/LaunchpadGrid.tsx` | V2 form controls |
| Shrink | `src/renderer/src/components/agents/AgentLaunchpad.css` | Token-driven |
| Modify | `src/renderer/src/components/agents/FleetGlance.tsx` | Tile grid + metrics |
| Shrink | `src/renderer/src/components/agents/FleetGlance.css` | Token-driven |
| Update | `docs/modules/components/index.md` | Module docs |

---

## Task 1: Feature flag + V1 fork + dispatcher

**Files:**
- Modify: `src/renderer/src/stores/featureFlags.ts`
- Rename: `src/renderer/src/views/AgentsView.tsx` → `AgentsViewV1.tsx`
- Create: `src/renderer/src/views/AgentsView.tsx` (dispatcher)

- [ ] **Step 1: Add `v2Agents` to featureFlags store**

Open `src/renderer/src/stores/featureFlags.ts`. Add `v2Agents: false` to the `Flags` interface, to `loadFlags()` defaults, and to `persistFlags()`:

```typescript
interface Flags {
  v2Shell: boolean
  v2Dashboard: boolean
  v2Pipeline: boolean
  v2Agents: boolean
}

// In loadFlags():
return {
  v2Shell: parsed.v2Shell ?? false,
  v2Dashboard: parsed.v2Dashboard ?? false,
  v2Pipeline: parsed.v2Pipeline ?? false,
  v2Agents: parsed.v2Agents ?? false,
}

// In persistFlags():
localStorage.setItem(STORAGE_KEY, JSON.stringify({
  v2Shell: flags.v2Shell,
  v2Dashboard: flags.v2Dashboard,
  v2Pipeline: flags.v2Pipeline,
  v2Agents: flags.v2Agents,
}))

// In create() initial state:
return { v2Shell: false, v2Dashboard: false, v2Pipeline: false, v2Agents: false }
```

- [ ] **Step 2: Copy current AgentsView.tsx to AgentsViewV1.tsx**

```bash
cp src/renderer/src/views/AgentsView.tsx src/renderer/src/views/AgentsViewV1.tsx
```

Inside `AgentsViewV1.tsx`: rename the exported function from `AgentsView` to `AgentsViewV1`. Update the CSS import from `'./AgentsView.css'` to `'./AgentsViewV1.css'`.

```bash
cp src/renderer/src/views/AgentsView.css src/renderer/src/views/AgentsViewV1.css 2>/dev/null || true
```

- [ ] **Step 3: Create dispatcher at `src/renderer/src/views/AgentsView.tsx`**

```typescript
import { useFeatureFlags } from '../stores/featureFlags'
import { AgentsViewV1 } from './AgentsViewV1'
import { AgentsViewV2 } from './AgentsViewV2'

export function AgentsView(): React.JSX.Element {
  const v2Agents = useFeatureFlags((s) => s.v2Agents)
  return v2Agents ? <AgentsViewV2 /> : <AgentsViewV1 />
}
```

- [ ] **Step 4: Create stub `src/renderer/src/views/AgentsViewV2.tsx`**

```typescript
export function AgentsViewV2(): React.JSX.Element {
  return (
    <div style={{ padding: 'var(--s-5)', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
      V2 Agents view — coming soon (Phase 5 implementation in progress)
    </div>
  )
}
```

- [ ] **Step 5: Run typecheck to verify no breakage**

```bash
npm run typecheck
```
Expected: zero errors.

- [ ] **Step 6: Run tests**

```bash
npm test
```
Expected: all tests pass (V1 still renders by default, dispatcher is trivial).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/stores/featureFlags.ts src/renderer/src/views/AgentsView.tsx src/renderer/src/views/AgentsViewV1.tsx src/renderer/src/views/AgentsViewV1.css src/renderer/src/views/AgentsViewV2.tsx
git commit -m "feat(agents): add v2Agents feature flag, fork V1, stub V2 dispatcher"
```

---

## Task 2: ScratchpadBanner + AgentRow V2

**Files:**
- Create: `src/renderer/src/components/agents/ScratchpadBanner.tsx`
- Create: `src/renderer/src/components/agents/AgentRow.tsx`
- Create: `src/renderer/src/components/agents/__tests__/AgentRow.test.tsx`

- [ ] **Step 1: Write failing test for AgentRow**

Create `src/renderer/src/components/agents/__tests__/AgentRow.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentRow } from '../AgentRow'
import type { AgentMeta } from '../../../../../shared/types'

const base: AgentMeta = {
  id: 'abc123',
  status: 'running',
  task: 'implement feature X',
  model: 'claude-haiku-4-5',
  repo: 'fleet',
  repoPath: '/tmp/fleet',
  startedAt: new Date(Date.now() - 60_000).toISOString(),
  finishedAt: null,
  pid: null,
  bin: 'claude',
  exitCode: null,
  logPath: '/tmp/log',
  source: 'fleet',
  costUsd: null,
  tokensIn: null,
  tokensOut: null,
  sprintTaskId: null
}

describe('AgentRow', () => {
  it('renders agent id and task text', () => {
    render(<AgentRow agent={base} selected={false} onClick={vi.fn()} />)
    expect(screen.getByText('abc123')).toBeDefined()
    expect(screen.getByText(/fleet/)).toBeDefined()
  })

  it('shows fleet-pulse for running agents', () => {
    const { container } = render(<AgentRow agent={base} selected={false} onClick={vi.fn()} />)
    expect(container.querySelector('.fleet-pulse')).toBeTruthy()
  })

  it('shows static dot for non-running agents', () => {
    const agent = { ...base, status: 'done' as const, finishedAt: new Date().toISOString() }
    const { container } = render(<AgentRow agent={agent} selected={false} onClick={vi.fn()} />)
    expect(container.querySelector('.fleet-pulse')).toBeNull()
    expect(container.querySelector('.fleet-dot--done')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- AgentRow --run
```
Expected: FAIL — `AgentRow` not found.

- [ ] **Step 3: Create `ScratchpadBanner.tsx`**

Create `src/renderer/src/components/agents/ScratchpadBanner.tsx`:

```typescript
import { X } from 'lucide-react'

interface ScratchpadBannerProps {
  onDismiss: () => void
}

export function ScratchpadBanner({ onDismiss }: ScratchpadBannerProps): React.JSX.Element {
  return (
    <div
      role="status"
      style={{
        margin: '0 var(--s-2) var(--s-2)',
        padding: 'var(--s-2) var(--s-3)',
        background: 'var(--surf-1)',
        border: '1px solid var(--line)',
        borderLeft: '2px solid var(--accent)',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        gap: 'var(--s-2)',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1 }}>
        <div className="fleet-eyebrow" style={{ marginBottom: 4 }}>SCRATCHPAD</div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5 }}>
          Agents here run in isolated worktrees and aren&apos;t tracked in the sprint pipeline.
          Use <em>Promote → Review</em> to flow work into the review queue.
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss scratchpad notice"
        style={{
          width: 16, height: 16, flexShrink: 0,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--fg-4)', padding: 0, display: 'flex', alignItems: 'center',
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create `AgentRow.tsx`**

Create `src/renderer/src/components/agents/AgentRow.tsx`:

```typescript
import { timeAgo } from '../../lib/format'
import type { AgentMeta } from '../../../../shared/types'

interface AgentRowProps {
  agent: AgentMeta
  selected: boolean
  onClick: () => void
  currentStep?: string | undefined
  progressPct?: number | undefined
}

export function AgentRow({
  agent, selected, onClick, currentStep, progressPct = 0
}: AgentRowProps): React.JSX.Element {
  const isRunning = agent.status === 'running'
  const age = agent.startedAt ? timeAgo(agent.startedAt) : ''

  return (
    <button
      onClick={onClick}
      aria-label={`${agent.task} — ${agent.status}`}
      aria-current={selected ? 'true' : undefined}
      style={{
        width: '100%',
        padding: 'var(--s-2)',
        borderRadius: 'var(--r-md)',
        background: selected ? 'var(--surf-2)' : 'transparent',
        border: selected ? '1px solid var(--line-2)' : '1px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
        paddingLeft: selected ? 'calc(var(--s-2) + 2px)' : 'var(--s-2)',
        borderLeft: selected ? `2px solid var(--st-${agent.status})` : '2px solid transparent',
      }}
    >
      {/* Top line: indicator + id + age */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isRunning ? (
          <span className="fleet-pulse" style={{ width: 6, height: 6, flexShrink: 0 }} aria-label="Running" />
        ) : (
          <span className={`fleet-dot--${agent.status}`} style={{ width: 6, height: 6, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.id}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', flexShrink: 0 }}>
          {age}
        </span>
      </div>

      {/* Second line: repo prefix + current step */}
      <div style={{ fontSize: 12, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>
          {agent.repo} ›{' '}
        </span>
        {currentStep ?? agent.task}
      </div>

      {/* Third line (running only): progress bar */}
      {isRunning && (
        <div style={{ height: 2, background: 'var(--surf-3)', borderRadius: 999, overflow: 'hidden', marginLeft: 12 }}>
          <div style={{ height: '100%', width: `${Math.min(100, progressPct)}%`, background: 'var(--st-running)', transition: 'width 0.5s ease' }} />
        </div>
      )}
    </button>
  )
}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npm test -- AgentRow --run
```
Expected: PASS — 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/agents/ScratchpadBanner.tsx src/renderer/src/components/agents/AgentRow.tsx src/renderer/src/components/agents/__tests__/AgentRow.test.tsx
git commit -m "feat(agents): ScratchpadBanner extraction and AgentRow V2"
```

---

## Task 3: AgentList V2 refactor

**Files:**
- Modify: `src/renderer/src/components/agents/AgentList.tsx`
- Modify: `src/renderer/src/components/agents/AgentList.css`

- [ ] **Step 1: Note current CSS baseline**

```bash
wc -l src/renderer/src/components/agents/AgentList.css
```
Record the number (currently ~210 lines).

- [ ] **Step 2: Refactor `AgentList.tsx`**

Replace the content of `AgentList.tsx`. Keep the `groupAgents` export (tests depend on it). Replace the component body with the V2 structure. Key changes:

```typescript
import { AgentRow } from './AgentRow'
import { ScratchpadBanner } from './ScratchpadBanner'
// Remove: AgentCard, neonVar imports

type FilterKey = 'all' | 'live' | 'review' | 'failed' | 'done'

const FILTER_CHIPS: { key: FilterKey; label: string; status?: string }[] = [
  { key: 'all', label: 'all' },
  { key: 'live', label: 'live', status: 'running' },
  { key: 'review', label: 'review', status: 'review' },
  { key: 'failed', label: 'failed', status: 'failed' },
  { key: 'done', label: 'done', status: 'done' },
]

// In component, add:
const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

// Filtered agents based on activeFilter
const filteredAgents = useMemo(() => {
  if (activeFilter === 'all') return agents
  const filterStatus = FILTER_CHIPS.find(c => c.key === activeFilter)?.status
  if (!filterStatus) return agents
  return agents.filter(a => a.status === filterStatus)
}, [agents, activeFilter])

// Composition strip counts
const compositionCounts = useMemo(() => {
  const statuses = ['running', 'review', 'done', 'failed'] as const
  return statuses.map(s => ({ status: s, count: agents.filter(a => a.status === s).length }))
    .filter(s => s.count > 0)
}, [agents])

const totalCount = agents.length
```

The render structure:

```typescript
return (
  <div className="agent-list" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', borderRight: '1px solid var(--line)', minHeight: 0 }}>
    {/* Header band */}
    <div style={{ padding: 'var(--s-3) var(--s-4)', display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="fleet-eyebrow">FLEET</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--fg)' }}>{agents.length} agents</div>
        </div>
        <button
          onClick={/* pass openLaunchpad from props */}
          style={{ height: 26, padding: '0 var(--s-3)', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          + Spawn
        </button>
      </div>

      {/* Composition strip */}
      {totalCount > 0 && (
        <div style={{ height: 4, background: 'var(--surf-2)', borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
          {compositionCounts.map(({ status, count }) => (
            <div key={status} style={{ flex: count, background: `var(--st-${status})`, opacity: 0.85 }} />
          ))}
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {FILTER_CHIPS.map(chip => (
          <button
            key={chip.key}
            onClick={() => setActiveFilter(chip.key)}
            style={{
              padding: '3px var(--s-2)', borderRadius: 999, fontSize: 10, fontFamily: 'var(--font-mono)',
              background: activeFilter === chip.key ? 'var(--surf-2)' : 'transparent',
              border: `1px solid ${activeFilter === chip.key ? 'var(--line-2)' : 'var(--line)'}`,
              color: activeFilter === chip.key ? 'var(--fg)' : 'var(--fg-3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {chip.status && <span className={`fleet-dot--${chip.status}`} style={{ width: 5, height: 5 }} />}
            {chip.label}
            {' '}
            <span style={{ color: 'var(--fg-4)' }}>
              {chip.key === 'all' ? agents.length : agents.filter(a => a.status === chip.status).length}
            </span>
          </button>
        ))}
      </div>
    </div>

    {/* Search band */}
    <div style={{ padding: '0 var(--s-2) var(--s-2)' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={searchInputRef}
          type="text"
          value={filter ?? ''}
          onChange={e => {/* existing filter handler */}}
          placeholder="filter agents…"
          style={{ width: '100%', height: 28, background: 'var(--surf-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '0 var(--s-2)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)', boxSizing: 'border-box' }}
        />
      </div>
    </div>

    {/* ScratchpadBanner (passed as prop or local state) */}
    {showBanner && <ScratchpadBanner onDismiss={onDismissBanner} />}

    {/* Row list */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--s-2) var(--s-2)' }}>
      {loading ? <SkeletonRows /> : fetchError ? <ErrorBlock error={fetchError} onRetry={onRetry} /> : (
        <>
          {groups.running.length > 0 && (
            <>
              <div style={{ padding: 'var(--s-2) var(--s-1) 4px', fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--fg-4)' }}>
                Live · {groups.running.length}
              </div>
              {groups.running.map(agent => (
                <AgentRow key={agent.id} agent={agent} selected={agent.id === selectedId} onClick={() => onSelect(agent.id)} />
              ))}
            </>
          )}
          {(groups.recent.length > 0 || groups.history.length > 0) && (
            <>
              <div style={{ padding: 'var(--s-2) var(--s-1) 4px', fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--fg-4)' }}>
                Recent
              </div>
              {[...groups.recent, ...groups.history].map(agent => (
                <AgentRow key={agent.id} agent={agent} selected={agent.id === selectedId} onClick={() => onSelect(agent.id)} />
              ))}
            </>
          )}
          {agents.length === 0 && <EmptyAgentList onSpawn={onSpawn} />}
        </>
      )}
    </div>
  </div>
)
```

Note: `AgentList` needs two new props: `onSpawn: () => void` (for the Spawn button and empty state) and `showBanner: boolean` + `onDismissBanner: () => void` (for ScratchpadBanner). Update the `AgentListProps` interface accordingly.

Add local helper components:

```typescript
function SkeletonRows(): React.JSX.Element {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: 'var(--s-2)', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--surf-2)' }} />
          <div style={{ flex: 1, height: 10, background: 'var(--surf-2)', borderRadius: 4 }} />
          <div style={{ width: 40, height: 10, background: 'var(--surf-2)', borderRadius: 4 }} />
        </div>
      ))}
    </>
  )
}

function EmptyAgentList({ onSpawn }: { onSpawn: () => void }): React.JSX.Element {
  return (
    <div style={{ padding: 'var(--s-5) var(--s-3)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s-3)' }}>
      <div className="fleet-eyebrow">EMPTY</div>
      <div style={{ fontSize: 12, color: 'var(--fg)' }}>No agents yet</div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Spawn one to get started.</div>
      <button onClick={onSpawn} style={{ height: 26, padding: '0 var(--s-3)', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
        + Spawn
      </button>
    </div>
  )
}

function ErrorBlock({ error, onRetry }: { error: string; onRetry?: () => void }): React.JSX.Element {
  return (
    <div style={{ margin: 'var(--s-2)', background: 'var(--surf-1)', border: `1px solid color-mix(in oklch, var(--st-failed) 30%, transparent)`, borderRadius: 'var(--r-md)', padding: 'var(--s-3)' }}>
      <div className="fleet-eyebrow" style={{ color: 'var(--st-failed)', marginBottom: 4 }}>FETCH FAILED</div>
      <div style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 8 }}>Could not load agents.</div>
      {onRetry && (
        <button onClick={onRetry} style={{ fontSize: 11, background: 'transparent', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '3px var(--s-2)', cursor: 'pointer', color: 'var(--fg-2)' }}>
          Retry
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Shrink `AgentList.css`**

Replace with just a bare minimum (the groupAgents logic and V1 classes can go away since styles are now inline):

```css
/* AgentList V2 — minimal token-driven styles */
.agent-list {
  width: 320px;
  flex-shrink: 0;
}
```

(All layout/color is now inline using V2 tokens.)

- [ ] **Step 4: Update existing AgentList tests**

The `groupAgents` function is unchanged. The render test needs to be updated because the component now needs an `onSpawn` prop. Update the test file to add `onSpawn={vi.fn()}`. Update any snapshot if it exists.

```bash
npm test -- AgentList --run
```
Expected: all tests pass (update snapshots if needed with `npm test -- AgentList --run -u`).

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/agents/AgentList.tsx src/renderer/src/components/agents/AgentList.css
git commit -m "feat(agents): AgentList V2 — banded layout, filter chips, composition strip"
```

---

## Task 4: AgentConsoleHeader V2

**Files:**
- Rename: `src/renderer/src/components/agents/ConsoleHeader.tsx` → `AgentConsoleHeader.tsx`
- Rename: `src/renderer/src/components/agents/ConsoleHeader.css` → `AgentConsoleHeader.css`
- Update: any imports of `ConsoleHeader`

- [ ] **Step 1: Rename files**

```bash
mv src/renderer/src/components/agents/ConsoleHeader.tsx src/renderer/src/components/agents/AgentConsoleHeader.tsx
mv src/renderer/src/components/agents/ConsoleHeader.css src/renderer/src/components/agents/AgentConsoleHeader.css
mv src/renderer/src/components/agents/__tests__/ConsoleHeader.test.tsx src/renderer/src/components/agents/__tests__/AgentConsoleHeader.test.tsx
```

- [ ] **Step 2: Update export name and CSS import in `AgentConsoleHeader.tsx`**

Change `export function ConsoleHeader` → `export function AgentConsoleHeader`. Change `import './ConsoleHeader.css'` → `import './AgentConsoleHeader.css'`.

Update `AgentConsole.tsx` to import `AgentConsoleHeader` instead of `ConsoleHeader`.

- [ ] **Step 3: Refactor `AgentConsoleHeader.tsx` to V2 styling**

Replace the component's render (keep all existing logic: `getDuration`, `costUsd`, `handleStop`, `handleCopyLog`, `handlePromote`, `fetchContextTokens`, etc.). Replace only the JSX structure:

```typescript
// Remove: NeonBadge import, getModelAccent function
// Keep: all existing logic, hooks, handlers

return (
  <>
    <div style={{
      height: 48, padding: '0 var(--s-5)', borderBottom: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', gap: 'var(--s-3)', flexShrink: 0,
    }}>
      {/* Left: status dot + two-line stack */}
      <span className={`fleet-dot--${agent.status}`} style={{ width: 8, height: 8, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', flex: '0 0 auto', maxWidth: 200 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.id}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.repo}
          {agent.worktreePath ? ` · worktree:${agent.worktreePath.split('/').pop()}` : ''}
          {agent.pid ? ` · pid ${agent.pid}` : ''}
          {` · started ${new Date(agent.startedAt).toLocaleTimeString()}`}
        </span>
      </div>

      {/* Center spacer */}
      <div style={{ flex: 1 }} />

      {/* Right: stats + separator + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <StatBlock label="tokens" value={contextTokens ? `${Math.round((isRunning ? contextTokens.current : contextTokens.peak) / 1000)}k` : '—'} />
        <div style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 var(--s-2)' }} />
        <StatBlock label="cost" value={costUsd != null ? `$${costUsd.toFixed(4)}` : '—'} />
        <div style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 var(--s-2)' }} />
        <StatBlock label="elapsed" value={duration} />
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 var(--s-1)' }} />

      <div style={{ display: 'flex', gap: 'var(--s-1)', alignItems: 'center' }}>
        {canPromote && (
          <button onClick={handlePromote} style={actionBtnStyle('accent')}>
            Promote → Review
          </button>
        )}
        {isRunning && (
          <button onClick={handleStop} style={actionBtnStyle('danger')}>
            Kill
          </button>
        )}
        <button onClick={handleCopyLog} style={actionBtnStyle('secondary')} title="Copy log">
          Copy log
        </button>
        <button onClick={handleOpenShell} style={actionBtnStyle('secondary')} title="Open terminal">
          Shell
        </button>
      </div>
    </div>
    <ConfirmModal {...confirmProps} />
  </>
)
```

Add local helper functions:

```typescript
function StatBlock({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)', fontWeight: 500 }}>
        {value}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--fg-3)' }}>
        {label}
      </span>
    </div>
  )
}

function actionBtnStyle(variant: 'accent' | 'secondary' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = { height: 26, padding: '0 var(--s-3)', fontSize: 12, borderRadius: 'var(--r-md)', cursor: 'pointer', border: 'none', fontWeight: 500 }
  if (variant === 'accent') return { ...base, background: 'var(--accent)', color: 'var(--accent-fg)' }
  if (variant === 'danger') return { ...base, background: 'transparent', border: `1px solid color-mix(in oklch, var(--st-failed) 30%, transparent)`, color: 'var(--st-failed)' }
  return { ...base, background: 'transparent', border: '1px solid var(--line)', color: 'var(--fg-2)' }
}
```

- [ ] **Step 4: Replace `AgentConsoleHeader.css` with minimal styles**

```css
/* AgentConsoleHeader V2 — layout via inline styles + V2 tokens */
```

(Fully empty or minimal — all layout is inline now.)

- [ ] **Step 5: Update test import**

In `AgentConsoleHeader.test.tsx`, change `import { ConsoleHeader }` → `import { AgentConsoleHeader }` and update references.

```bash
npm test -- AgentConsoleHeader --run
```
Expected: all passing (update snapshots with `-u` if needed).

- [ ] **Step 6: Run typecheck + commit**

```bash
npm run typecheck && npm test -- --run
git add src/renderer/src/components/agents/AgentConsoleHeader.tsx src/renderer/src/components/agents/AgentConsoleHeader.css src/renderer/src/components/agents/__tests__/AgentConsoleHeader.test.tsx src/renderer/src/components/agents/AgentConsole.tsx
git commit -m "feat(agents): AgentConsoleHeader V2 — rename, V2 token styling, static status dot"
```

---

## Task 5: AgentConsoleStream + AgentComposer

**Files:**
- Create: `src/renderer/src/components/agents/AgentConsoleStream.tsx`
- Create: `src/renderer/src/components/agents/AgentComposer.tsx`

- [ ] **Step 1: Write failing render test for AgentComposer**

Create `src/renderer/src/components/agents/__tests__/AgentComposer.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentComposer } from '../AgentComposer'

describe('AgentComposer', () => {
  it('renders send button when not streaming', () => {
    render(<AgentComposer onSend={vi.fn()} onCommand={vi.fn()} disabled={false} streaming={false} />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDefined()
  })

  it('renders stop button while streaming', () => {
    render(<AgentComposer onSend={vi.fn()} onCommand={vi.fn()} disabled={false} streaming={true} />)
    expect(screen.getByRole('button', { name: /stop/i })).toBeDefined()
  })

  it('disables send when input is empty', () => {
    render(<AgentComposer onSend={vi.fn()} onCommand={vi.fn()} disabled={false} streaming={false} />)
    const btn = screen.getByRole('button', { name: /send/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- AgentComposer --run
```
Expected: FAIL.

- [ ] **Step 3: Create `AgentConsoleStream.tsx`**

This extracts the virtual-scroll stream from `AgentConsole`. The stream component owns: virtualizer, scroll handling, jump button, search query application. It does NOT own: search bar open/close state (that stays in AgentConsole), agent fetching, or playground.

```typescript
import { useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, Loader } from 'lucide-react'
import type { ChatBlock } from '../../lib/pair-events'
import { ConsoleCard } from './cards/ConsoleCard'
import type { PlaygroundContentType } from '../../../../shared/types'

interface AgentConsoleStreamProps {
  blocks: ChatBlock[]
  matchingIndicesSet: Set<number>
  matchingIndicesArray: number[]
  activeMatchIndex: number
  onPlaygroundClick: (block: { filename: string; html: string; contentType: PlaygroundContentType; sizeBytes: number }) => void
  isRunning: boolean
}

export function AgentConsoleStream({
  blocks, matchingIndicesSet, matchingIndicesArray, activeMatchIndex, onPlaygroundClick, isRunning
}: AgentConsoleStreamProps): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [showJumpButton, setShowJumpButton] = useState(false)

  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  })

  useEffect(() => {
    if (isAtBottomRef.current && blocks.length > 0) {
      virtualizer.scrollToIndex(blocks.length - 1, { align: 'end' })
    }
  }, [blocks.length, virtualizer])

  // Scroll to active match when it changes
  useEffect(() => {
    const target = matchingIndicesArray[activeMatchIndex]
    if (target !== undefined) virtualizer.scrollToIndex(target, { align: 'center' })
  }, [activeMatchIndex, matchingIndicesArray, virtualizer])

  const handleScroll = (): void => {
    const el = parentRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    isAtBottomRef.current = atBottom
    setShowJumpButton(!atBottom && blocks.length > 0)
  }

  const handleJumpToLatest = (): void => {
    if (blocks.length > 0) {
      virtualizer.scrollToIndex(blocks.length - 1, { align: 'end' })
      isAtBottomRef.current = true
      setShowJumpButton(false)
    }
  }

  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
      <div ref={parentRef} onScroll={handleScroll} className="console-body" role="log" aria-label="Agent console output">
        {blocks.length > 0 ? (
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const blockIndex = virtualRow.index
              const isMatch = matchingIndicesSet.has(blockIndex)
              const isActiveMatch = isMatch && matchingIndicesArray[activeMatchIndex] === blockIndex
              const searchHighlight = isActiveMatch ? 'active' : isMatch ? 'match' : undefined
              const block = blocks[blockIndex]
              if (!block) return null
              return (
                <div key={virtualRow.key} data-index={virtualRow.index} ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}>
                  <ConsoleCard block={block} onPlaygroundClick={onPlaygroundClick} searchHighlight={searchHighlight} />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="console-empty-state" role="status">
            {isRunning ? (
              <><Loader size={20} className="console-empty-state__spinner" aria-hidden /><span>Waiting for agent output…</span></>
            ) : (
              <span>No events recorded for this agent</span>
            )}
          </div>
        )}
      </div>
      {showJumpButton && (
        <button onClick={handleJumpToLatest} className="console-jump-to-latest">
          Jump to latest <ChevronDown size={16} />
        </button>
      )}
    </div>
  )
}
```

(Note: `useState` is used inside this component — add the import.)

- [ ] **Step 4: Create `AgentComposer.tsx`**

This wraps `CommandBar` in V2 chrome. It reuses all CommandBar behavior.

```typescript
import { CommandBar } from './CommandBar'
import type { Attachment } from '../../../../shared/types'

interface AgentComposerProps {
  onSend: (message: string, attachment?: Attachment) => void
  onCommand: (cmd: string, args?: string) => void
  disabled: boolean
  streaming: boolean
  model?: string | undefined
  tokensUsed?: number | undefined
  tokensMax?: number | undefined
}

export function AgentComposer({ onSend, onCommand, disabled, streaming, model, tokensUsed, tokensMax }: AgentComposerProps): React.JSX.Element {
  return (
    <div style={{ padding: 'var(--s-3) var(--s-5)', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
      <div style={{ background: 'var(--surf-1)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-lg)', padding: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        {/* CommandBar provides the textarea + slash-command handling + attachments */}
        <CommandBar
          onSend={onSend}
          onCommand={onCommand}
          disabled={disabled || streaming}
          disabledReason={disabled ? 'Agent not running' : streaming ? 'Agent is responding…' : undefined}
        />

        {/* Bottom row: model info */}
        {(model || tokensUsed !== undefined) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>
              {model}{tokensUsed !== undefined && ` · ${Math.round(tokensUsed / 1000)}k${tokensMax !== undefined ? ` / ${Math.round(tokensMax / 1000)}k` : ''}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run AgentComposer test**

```bash
npm test -- AgentComposer --run
```
Expected: PASS.

- [ ] **Step 6: Run typecheck + commit**

```bash
npm run typecheck
git add src/renderer/src/components/agents/AgentConsoleStream.tsx src/renderer/src/components/agents/AgentComposer.tsx src/renderer/src/components/agents/__tests__/AgentComposer.test.tsx
git commit -m "feat(agents): AgentConsoleStream and AgentComposer V2 sub-components"
```

---

## Task 6: AgentConsole V2 assembly

**Files:**
- Modify: `src/renderer/src/components/agents/AgentConsole.tsx`
- Modify: `src/renderer/src/components/agents/AgentConsole.css`

- [ ] **Step 1: Refactor `AgentConsole.tsx` to assemble sub-components**

The file now coordinates state; AgentConsoleHeader, AgentConsoleStream, AgentComposer do the rendering. Remove the virtualizer, scroll logic, and jump-button logic (all moved to AgentConsoleStream).

The remaining AgentConsole state:
- `agent` lookup
- `events`, `wasEvicted`
- `pairedBlocks` + `pendingMessages` + `blocks` memo
- Search state: `searchOpen`, `searchQuery`, `activeMatchIndex`
- Search helpers: `blockMatchesQuery`, `matchingIndicesArray`, `matchingIndicesSet`
- `playgroundBlock` state
- `handleSteer` (adds pending message)
- `handleSearchChange`, `handleSearchNext`, `handleSearchPrev`, `handleSearchClose`
- Cmd+F keyboard shortcut

```typescript
export function AgentConsole({ agentId, onSteer, onCommand }: AgentConsoleProps): React.JSX.Element {
  // ...all existing state preserved...

  if (!agent) return <div className="agent-console"><div style={{ padding: 16, color: 'var(--fg-3)', textAlign: 'center' }}>Agent not found</div></div>

  return (
    <div className="agent-console">
      <AgentConsoleHeader agent={agent} events={events} />

      {wasEvicted && (
        <div style={{ padding: 'var(--s-2) var(--s-5)', fontSize: 11, color: 'var(--fg-3)', borderBottom: '1px solid var(--line)', background: 'var(--surf-1)' }}>
          Older events were trimmed (showing last 2,000)
        </div>
      )}

      {searchOpen && (
        <ConsoleSearchBar
          value={searchQuery}
          onSearch={handleSearchChange}
          onClose={handleSearchClose}
          matchCount={matchingIndicesArray.length}
          activeMatch={matchingIndicesArray.length > 0 ? activeMatchIndex + 1 : 0}
          onNext={handleSearchNext}
          onPrev={handleSearchPrev}
        />
      )}

      <AgentConsoleStream
        blocks={blocks}
        matchingIndicesSet={matchingIndicesSet}
        matchingIndicesArray={matchingIndicesArray}
        activeMatchIndex={activeMatchIndex}
        onPlaygroundClick={setPlaygroundBlock}
        isRunning={agent.status === 'running'}
      />

      <AgentComposer
        onSend={handleSteer}
        onCommand={onCommand}
        disabled={agent.status !== 'running'}
        streaming={false}
        model={agent.model}
      />

      {playgroundBlock && (
        <PlaygroundModal html={playgroundBlock.html} filename={playgroundBlock.filename} contentType={playgroundBlock.contentType} sizeBytes={playgroundBlock.sizeBytes} onClose={() => setPlaygroundBlock(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Shrink `AgentConsole.css`**

Keep only the bare minimum:

```css
.agent-console {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg);
}

.console-body {
  overflow: auto;
  padding: var(--s-4) var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}

.console-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  color: var(--fg-3);
  padding: var(--s-8) var(--s-5);
}

.console-empty-state__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.console-jump-to-latest {
  position: absolute;
  bottom: var(--s-3);
  right: var(--s-5);
  background: var(--surf-2);
  border: 1px solid var(--line-2);
  border-radius: var(--r-md);
  padding: var(--s-1) var(--s-3);
  cursor: pointer;
  font-size: 11px;
  color: var(--fg-2);
  display: flex;
  align-items: center;
  gap: 4px;
}

.console-cap-banner {
  padding: var(--s-2) var(--s-5);
  font-size: 11px;
  color: var(--fg-3);
  border-bottom: 1px solid var(--line);
  background: var(--surf-1);
}
```

- [ ] **Step 3: Run existing console tests**

```bash
npm test -- AgentConsole --run
```
Expected: PASS (update snapshots with `-u` if chrome changed).

- [ ] **Step 4: Run typecheck + commit**

```bash
npm run typecheck
git add src/renderer/src/components/agents/AgentConsole.tsx src/renderer/src/components/agents/AgentConsole.css src/renderer/src/components/agents/AgentConsoleStream.tsx
git commit -m "feat(agents): AgentConsole V2 — assemble sub-components, shrink CSS"
```

---

## Task 7: AgentInspector (new)

**Files:**
- Create: `src/renderer/src/components/agents/AgentInspector.tsx`
- Create: `src/renderer/src/components/agents/AgentInspector.css`
- Create: `src/renderer/src/components/agents/__tests__/AgentInspector.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentInspector } from '../AgentInspector'
import type { AgentMeta } from '../../../../../shared/types'

vi.mock('../../../../../preload/index', () => ({ window: { api: {} } }))

const agent: AgentMeta = {
  id: 'abc123', status: 'running', task: 'test task',
  model: 'sonnet', repo: 'fleet', repoPath: '/tmp/fleet',
  startedAt: new Date().toISOString(), finishedAt: null,
  pid: null, bin: 'claude', exitCode: null, logPath: null,
  source: 'fleet', costUsd: null, tokensIn: null, tokensOut: null, sprintTaskId: null
}

describe('AgentInspector', () => {
  it('renders all six section eyebrows', () => {
    render(<AgentInspector agent={agent} events={[]} />)
    expect(screen.getByText('SENT TO AGENT')).toBeDefined()
    expect(screen.getByText('ON DISK')).toBeDefined()
    expect(screen.getByText('WORKSPACE')).toBeDefined()
    expect(screen.getByText('SCOPE')).toBeDefined()
    expect(screen.getByText('TELEMETRY')).toBeDefined()
    expect(screen.getByText('TRACE')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- AgentInspector --run
```
Expected: FAIL.

- [ ] **Step 3: Create `AgentInspector.tsx`**

```typescript
import type { AgentMeta, AgentEvent } from '../../../../shared/types'
import { MiniStat } from '../sprint/primitives/MiniStat'
import { MicroSpark } from '../dashboard/primitives/MicroSpark'
import { formatDuration, formatElapsed } from '../../lib/format'
import { useAgentEventsStore } from '../../stores/agentEvents'

interface AgentInspectorProps {
  agent: AgentMeta
  events: AgentEvent[]
}

interface SectionProps {
  eyebrow: string
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}

function Section({ eyebrow, title, right, children }: SectionProps): React.JSX.Element {
  return (
    <div style={{ padding: 'var(--s-3) var(--s-4)', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--s-2)' }}>
        <div>
          <div className="fleet-eyebrow">{eyebrow}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg)', marginTop: 2 }}>{title}</div>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

export function AgentInspector({ agent, events }: AgentInspectorProps): React.JSX.Element {
  const isRunning = agent.status === 'running'

  // Derive token counts from events for the sparkline
  const tokenPoints = events
    .filter(e => e.type === 'agent:turn_end' || e.type === 'agent:completed')
    .map(e => ('tokensIn' in e ? (e.tokensIn as number) ?? 0 : 0))
    .slice(-20)

  // Derive files touched from edit/write/bash events (best-effort)
  const filesTouched = events
    .filter(e => e.type === 'agent:tool_use' && ('path' in e || 'filePath' in e))
    .map(e => ({ path: ('path' in e ? String(e.path) : String('filePath' in e ? e.filePath : '')) || '?', additions: 0, deletions: 0 }))
    .filter((f, i, arr) => arr.findIndex(x => x.path === f.path) === i)
    .slice(0, 15)

  // Recent timeline (last 10 events)
  const recentEvents = events.slice(-10).reverse()

  const mapEventToStatus = (e: AgentEvent): string => {
    if (e.type === 'agent:tool_use') return 'running'
    if (e.type === 'agent:completed') return 'done'
    if (e.type === 'agent:error') return 'failed'
    return 'queued'
  }

  const elapsed = isRunning
    ? formatElapsed(new Date(agent.startedAt).getTime())
    : formatDuration(agent.startedAt, agent.finishedAt)

  const totalTokens = (agent.tokensIn ?? 0) + (agent.tokensOut ?? 0)

  return (
    <div className="agent-inspector">
      {/* §6.1 Task prompt */}
      <Section eyebrow="SENT TO AGENT" title="Task prompt">
        <pre style={{
          background: 'var(--surf-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
          padding: 'var(--s-2) var(--s-3)', fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--fg-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 100, overflowY: 'auto', margin: 0,
        }}>
          {/* TODO(verify): where does the task prompt live on AgentMeta? Using agent.task as placeholder */}
          {agent.task ?? 'No prompt recorded'}
        </pre>
      </Section>

      {/* §6.2 Task spec */}
      <Section eyebrow="ON DISK" title="Task spec" right={
        <button style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0 }}>
          Open in IDE
        </button>
      }>
        {/* TODO(verify): is task spec a file path or an inline body? Rendering file-path version as placeholder */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-4)' }}>📄</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agent.worktreePath ? `${agent.worktreePath}/spec.md` : 'No spec file'}
          </span>
        </div>
      </Section>

      {/* §6.3 Worktree */}
      <Section eyebrow="WORKSPACE" title="Worktree">
        {[
          { key: 'branch', value: `agent/${agent.id.slice(0, 8)}` },
          { key: 'base', value: 'main · ↑0 ↓0' },
          { key: 'path', value: agent.worktreePath ?? '—' },
          { key: 'diff', value: '+0 −0 · 0 files' },
        ].map(({ key, value }) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <span style={{ color: 'var(--fg-3)' }}>{key}</span>
            <span style={{ color: 'var(--fg)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
          </div>
        ))}
        {/* TODO(verify): branch name and diff stats need actual git data — placeholder values used */}
      </Section>

      {/* §6.4 Files touched */}
      <Section eyebrow="SCOPE" title="Files touched" right={
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{filesTouched.length}</span>
      }>
        {filesTouched.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>No file events yet</div>
        ) : (
          filesTouched.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              <span style={{ flex: 1, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
            </div>
          ))
        )}
      </Section>

      {/* §6.5 Run metrics */}
      <Section eyebrow="TELEMETRY" title="Run metrics">
        {tokenPoints.length >= 2 && (
          <div style={{ marginBottom: 'var(--s-2)' }}>
            <MicroSpark accent="running" points={tokenPoints} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-2)' }}>
          <MiniStat label="tokens" value={totalTokens > 0 ? `${Math.round(totalTokens / 1000)}k` : '—'} />
          <MiniStat label="cost" value={agent.costUsd != null ? `$${agent.costUsd.toFixed(4)}` : '—'} />
          <MiniStat label="tools" value={String(events.filter(e => e.type === 'agent:tool_use').length)} />
          <MiniStat label="elapsed" value={elapsed} />
        </div>
      </Section>

      {/* §6.6 Recent timeline */}
      <Section eyebrow="TRACE" title="Recent timeline">
        {recentEvents.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>No events yet</div>
        ) : (
          recentEvents.map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 8px 1fr', gap: 8, padding: '4px 0', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              <span style={{ color: 'var(--fg-4)' }}>
                {new Date(e.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`fleet-dot--${mapEventToStatus(e)}`} style={{ width: 6, height: 6 }} />
              <span style={{ color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.type.replace('agent:', '')}
              </span>
            </div>
          ))
        )}
      </Section>
    </div>
  )
}
```

- [ ] **Step 4: Create `AgentInspector.css`**

```css
.agent-inspector {
  width: 320px;
  flex-shrink: 0;
  background: var(--bg);
  border-left: 1px solid var(--line);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 5: Run test**

```bash
npm test -- AgentInspector --run
```
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/renderer/src/components/agents/AgentInspector.tsx src/renderer/src/components/agents/AgentInspector.css src/renderer/src/components/agents/__tests__/AgentInspector.test.tsx
git commit -m "feat(agents): AgentInspector — new six-section pane for Console mode"
```

---

## Task 8: AgentLaunchpad V2 refactor

**Files:**
- Modify: `src/renderer/src/components/agents/AgentLaunchpad.tsx`
- Modify: `src/renderer/src/components/agents/LaunchpadGrid.tsx`
- Shrink: `src/renderer/src/components/agents/AgentLaunchpad.css`
- Shrink: `src/renderer/src/components/agents/LaunchpadGrid.css`

- [ ] **Step 1: Check current test state**

```bash
npm test -- AgentLaunchpad LaunchpadGrid --run
```
Record what passes — don't weaken these assertions.

- [ ] **Step 2: Refactor `AgentLaunchpad.tsx`**

The current `AgentLaunchpad` is a thin wrapper around `LaunchpadGrid`. Make it the full center-column form (center the content itself here, and let LaunchpadGrid handle the fields):

```typescript
import './AgentLaunchpad.css'
import { LaunchpadGrid } from './LaunchpadGrid'
import type { PromptTemplate } from '../../lib/launchpad-types'
import { useState } from 'react'

interface AgentLaunchpadProps {
  onAgentSpawned: () => void
  onCancel?: () => void
}

export function AgentLaunchpad({ onAgentSpawned, onCancel }: AgentLaunchpadProps): React.JSX.Element {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-7) var(--s-9)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="fleet-eyebrow">SPAWN AGENT</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
            New scratchpad agent
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5 }}>
            Runs in an isolated worktree. Not tracked in the sprint pipeline until you promote it.
          </p>
        </div>

        {/* Form */}
        <LaunchpadGrid onAgentSpawned={onAgentSpawned} onCancel={onCancel} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Refactor `LaunchpadGrid.tsx`**

Replace V1 ACCENT_VARS and `--fleet-*` tokens with V2 inline styles. Add a `FormRow` primitive and the crucial **Task spec** / **Task prompt** distinction:

Add `FormRow` helper:

```typescript
function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg)' }}>{label}</label>
        {hint && <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  height: 32, background: 'var(--surf-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
  padding: '0 var(--s-3)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)',
  width: '100%', appearance: 'none', cursor: 'pointer',
}

const textareaStyle: React.CSSProperties = {
  minHeight: 96, padding: 'var(--s-2) var(--s-3)', background: 'var(--surf-1)',
  border: '1px solid var(--line)', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)',
  fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5, resize: 'vertical' as const, width: '100%', boxSizing: 'border-box' as const,
}
```

The form fields (in LaunchpadGrid render):

```typescript
<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
  <FormRow label="Repository">
    <select style={selectStyle} value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)}>
      {repoOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
    </select>
  </FormRow>

  <FormRow label="Base branch" hint="branch to fork from">
    <select style={selectStyle}>
      <option>main · ↑0 ↓0</option>
    </select>
  </FormRow>

  <FormRow label="Task spec" hint="step-by-step instructions file in the worktree">
    {/* TODO(verify): wire Browse to IDE file picker when available */}
    <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
      <input type="text" placeholder="path/to/spec.md" style={{ ...selectStyle, flex: 1 }} value={specPath} onChange={e => setSpecPath(e.target.value)} />
      <button style={{ height: 32, padding: '0 var(--s-2)', background: 'transparent', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', cursor: 'pointer' }}>
        Browse…
      </button>
    </div>
  </FormRow>

  <FormRow label="Task prompt" hint="opening message sent to the agent (includes spec path)">
    <textarea style={textareaStyle} value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="Read the spec at $SPEC_PATH. Implement step-by-step." />
  </FormRow>

  <FormRow label="Model">
    <select style={selectStyle} value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
      <option value="claude-haiku-4-5-20251001">claude-haiku-4-5 (default)</option>
      <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
    </select>
  </FormRow>

  <FormRow label="Budget cap" hint="USD hard stop">
    <input type="number" step="0.50" min="0.50" max="50.00" defaultValue="5.00" style={{ ...selectStyle, width: 120 }} />
  </FormRow>
</div>

{/* Footer */}
<div style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--s-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-4)' }}>
    scratchpad agents auto-clean after 24h idle
  </span>
  <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
    {onCancel && (
      <button onClick={onCancel} style={{ height: 30, padding: '0 var(--s-3)', background: 'transparent', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', fontSize: 12, cursor: 'pointer', color: 'var(--fg-2)' }}>
        Cancel
      </button>
    )}
    <button onClick={handleSpawn} disabled={spawning} style={{ height: 30, padding: '0 var(--s-3)', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 500, cursor: spawning ? 'default' : 'pointer', opacity: spawning ? 0.7 : 1 }}>
      {spawning ? 'Spawning…' : 'Spawn agent ↵'}
    </button>
  </div>
</div>
```

Keep all existing spawn logic (template selection, `window.api.agents.spawn` call).

Add `specPath` and `selectedModel` state. Add `onCancel` prop to `LaunchpadGridProps`.

- [ ] **Step 4: Run tests**

```bash
npm test -- AgentLaunchpad LaunchpadGrid --run
```
Expected: PASS (update snapshots with `-u` if chrome changed).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/renderer/src/components/agents/AgentLaunchpad.tsx src/renderer/src/components/agents/LaunchpadGrid.tsx src/renderer/src/components/agents/AgentLaunchpad.css src/renderer/src/components/agents/LaunchpadGrid.css
git commit -m "feat(agents): AgentLaunchpad V2 — center column, task spec + task prompt fields"
```

---

## Task 9: FleetGlance V2 refactor

**Files:**
- Modify: `src/renderer/src/components/agents/FleetGlance.tsx`
- Shrink: `src/renderer/src/components/agents/FleetGlance.css`

- [ ] **Step 1: Check current test state**

```bash
npm test -- FleetGlance --run
```
Record current passing count.

- [ ] **Step 2: Refactor `FleetGlance.tsx`**

Replace the status-row + list layout with the V2 tile grid + metrics row:

```typescript
import { MiniStat } from '../sprint/primitives/MiniStat'
// Remove: lucide icons (Loader, CheckCircle, XCircle, DollarSign, Clock)
// Keep: useMemo, formatDuration, formatElapsed, timeAgo, FleetGlanceProps

// In component render:
return (
  <div style={{ padding: 'var(--s-7) var(--s-8)', overflowY: 'auto', flex: 1 }}>
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>

      {/* §5.2 Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div className="fleet-eyebrow">FLEET · GLANCE</div>
          <h2 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 500, color: 'var(--fg)' }}>
            Pick an agent to focus, or spawn a new one
          </h2>
        </div>
        <button onClick={onSpawn} style={{ height: 30, padding: '0 var(--s-3)', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
          + Spawn agent
        </button>
      </div>

      {/* §5.3 Live tile grid */}
      {runningAgents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--s-3)' }}>
          {runningAgents.map(agent => (
            <AgentTile key={agent.id} agent={agent} onClick={() => onSelect(agent.id)} />
          ))}
        </div>
      )}

      {/* Recent agents (no pulse) */}
      {runningAgents.length === 0 && recentCompletions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--s-3)' }}>
          {recentCompletions.map(agent => (
            <AgentTile key={agent.id} agent={agent} onClick={() => onSelect(agent.id)} />
          ))}
        </div>
      )}

      {/* §5.4 Fleet metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-3)' }}>
        <MiniStat label="live" value={String(running)} />
        <MiniStat label="review" value="0" />
        <MiniStat label="done · 24h" value={String(doneToday)} />
        <MiniStat label="cost · 24h" value={formatCost(todayCost)} />
      </div>
    </div>
  </div>
)
```

Add `onSpawn` to `FleetGlanceProps`. Add local `AgentTile` component:

```typescript
function AgentTile({ agent, onClick }: { agent: AgentMeta; onClick: () => void }): React.JSX.Element {
  const isRunning = agent.status === 'running'
  const elapsed = isRunning ? formatElapsed(new Date(agent.startedAt).getTime()) : formatDuration(agent.startedAt, agent.finishedAt)
  return (
    <button onClick={onClick} style={{ padding: 'var(--s-3)', background: 'var(--surf-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 'var(--s-2)', width: '100%' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surf-2)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surf-1)' }}
    >
      {/* Top: indicator + id + age */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isRunning ? (
          <span className="fleet-pulse" style={{ width: 6, height: 6 }} />
        ) : (
          <span className={`fleet-dot--${agent.status}`} style={{ width: 6, height: 6 }} />
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.id}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', flexShrink: 0 }}>{timeAgo(agent.startedAt)}</span>
      </div>

      {/* Body: current step */}
      <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.4, minHeight: 32, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {agent.task}
      </div>

      {/* Progress bar (running only) */}
      {isRunning && (
        <div style={{ height: 2, background: 'var(--surf-3)', borderRadius: 999 }}>
          <div style={{ height: '100%', width: '30%', background: 'var(--st-running)' }} />
        </div>
      )}

      {/* Bottom: tokens + repo */}
      <div style={{ display: 'flex', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>
        <span style={{ flex: 1 }}>{elapsed}</span>
        <span style={{ color: 'var(--fg-4)' }}>{agent.repo}</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 3: Replace `FleetGlance.css`**

```css
/* FleetGlance V2 — token-driven inline styles */
```

- [ ] **Step 4: Run tests**

```bash
npm test -- FleetGlance --run
```
Expected: PASS (update snapshots if needed).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/renderer/src/components/agents/FleetGlance.tsx src/renderer/src/components/agents/FleetGlance.css
git commit -m "feat(agents): FleetGlance V2 — tile grid, fleet metrics, V2 tokens"
```

---

## Task 10: AgentsViewV2 full wiring

**Files:**
- Modify: `src/renderer/src/views/AgentsViewV2.tsx` (replace stub with full implementation)

- [ ] **Step 1: Replace the stub with the three-pane orchestrator**

This file is nearly identical to `AgentsViewV1.tsx` in logic; it differs in layout. All state and hooks are unchanged:

```typescript
import { useState, useCallback, useEffect } from 'react'
import { usePanelLayoutStore } from '../stores/panelLayout'
import { useAgentHistoryStore } from '../stores/agentHistory'
import { useAgentEventsStore } from '../stores/agentEvents'
import { AgentList } from '../components/agents/AgentList'
import { AgentConsole } from '../components/agents/AgentConsole'
import { AgentLaunchpad } from '../components/agents/AgentLaunchpad'
import { FleetGlance } from '../components/agents/FleetGlance'
import { AgentInspector } from '../components/agents/AgentInspector'
import { toast } from '../stores/toasts'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { buildLocalAgentMessage } from '../adapters/attachments'
import type { Attachment } from '../../../shared/types'
import { useAgentViewLifecycle } from '../hooks/useAgentViewLifecycle'
import { useAgentViewCommands } from '../hooks/useAgentViewCommands'
import { useAgentSlashCommands } from '../hooks/useAgentSlashCommands'
import { SPRINGS, REDUCED_TRANSITION, VARIANTS, useReducedMotion } from '../lib/motion'
import { motion } from 'framer-motion'

const INSPECTOR_BREAKPOINT = 1280

export function AgentsViewV2(): React.JSX.Element {
  const reduced = useReducedMotion()
  const activeView = usePanelLayoutStore((s) => s.activeView)
  const agents = useAgentHistoryStore((s) => s.agents)
  const fetched = useAgentHistoryStore((s) => s.fetched)
  const fetchError = useAgentHistoryStore((s) => s.fetchError)
  const fetchAgents = useAgentHistoryStore((s) => s.fetchAgents)
  const displayedCount = useAgentHistoryStore((s) => s.displayedCount)
  const hasMore = useAgentHistoryStore((s) => s.hasMore)
  const loadMore = useAgentHistoryStore((s) => s.loadMore)
  const loadHistory = useAgentEventsStore((s) => s.loadHistory)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? agents[0]?.id ?? null
  const [showLaunchpad, setShowLaunchpad] = useState(false)
  const [showScratchpadBanner, setShowScratchpadBanner] = useState(false)
  // Inspector slide-over state for narrow viewports
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth)

  useEffect(() => {
    const onResize = (): void => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isWide = viewportWidth >= INSPECTOR_BREAKPOINT

  const openLaunchpad = useCallback(() => {
    setSelectedId(null)
    setShowLaunchpad(true)
  }, [])

  useAgentViewLifecycle({ activeView, activeId, fetchAgents, loadHistory, setShowLaunchpad: openLaunchpad, setShowScratchpadBanner })

  const handleClearConsole = useCallback(() => {
    if (!activeId) { toast.info('No agent selected'); return }
    useAgentEventsStore.getState().clear(activeId)
  }, [activeId])

  useAgentViewCommands({ onSpawnAgent: openLaunchpad, handleClearConsole })

  const handleDismissBanner = useCallback(() => {
    setShowScratchpadBanner(false)
    window.api.settings.set('scratchpad.noticeDismissed', 'true')
  }, [])

  const selectedAgent = agents.find((a) => a.id === activeId)
  const events = useAgentEventsStore((s) => s.events[activeId ?? ''] ?? [])

  const handleSteer = useCallback(async (message: string, attachment?: Attachment) => {
    if (!activeId) return
    const textFormattedMessage = attachment?.type === 'text' ? buildLocalAgentMessage(message, [attachment]) : message
    const images = attachment?.type === 'image' && attachment.data && attachment.mimeType
      ? [{ data: attachment.data, mimeType: attachment.mimeType }] : undefined
    const result = await window.api.agents.steer(activeId, textFormattedMessage, images)
    if (!result.ok) toast.error(result.error ?? 'Failed to send message to agent')
  }, [activeId])

  const { handleCommand } = useAgentSlashCommands({ activeId, selectedAgent })

  const handleSelectAgent = useCallback((id: string) => {
    setSelectedId(id)
    setShowLaunchpad(false)
  }, [])

  const isConsoleMode = !!(selectedAgent && activeId && !showLaunchpad)
  const showInspector = isConsoleMode && (isWide || inspectorOpen)

  return (
    <ErrorBoundary name="AgentsViewV2">
      <motion.div
        variants={VARIANTS.fadeIn}
        initial="initial"
        animate="animate"
        transition={reduced ? REDUCED_TRANSITION : SPRINGS.snappy}
        style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}
      >
        {/* FleetList — 320px fixed */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <AgentList
            agents={agents}
            selectedId={activeId}
            onSelect={handleSelectAgent}
            onKill={fetchAgents}
            loading={!fetched && agents.length === 0 && !fetchError}
            fetchError={fetchError}
            onRetry={fetchAgents}
            displayedCount={displayedCount}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onSpawn={openLaunchpad}
            showBanner={showScratchpadBanner}
            onDismissBanner={handleDismissBanner}
          />
        </div>

        {/* Center pane — 1fr */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {showLaunchpad || (!selectedAgent && agents.length === 0) ? (
            <AgentLaunchpad
              onAgentSpawned={() => { setShowLaunchpad(false); fetchAgents() }}
              onCancel={agents.length > 0 ? () => setShowLaunchpad(false) : undefined}
            />
          ) : selectedAgent && activeId ? (
            <AgentConsole agentId={activeId} onSteer={handleSteer} onCommand={handleCommand} />
          ) : (
            <FleetGlance agents={agents} onSelect={handleSelectAgent} onSpawn={openLaunchpad} />
          )}
        </div>

        {/* Inspector — 320px fixed, Console mode only */}
        {showInspector && selectedAgent && (
          <AgentInspector agent={selectedAgent} events={events} />
        )}

        {/* Inspector slide-over toggle for narrow viewports */}
        {isConsoleMode && !isWide && (
          <button
            onClick={() => setInspectorOpen(o => !o)}
            style={{ position: 'absolute', top: 56, right: inspectorOpen ? 328 : 8, zIndex: 10, height: 24, padding: '0 var(--s-2)', background: 'var(--surf-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', color: 'var(--fg-3)' }}
          >
            {inspectorOpen ? 'Close inspector' : 'Inspector'}
          </button>
        )}
      </motion.div>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```
Expected: zero errors. Fix any prop mismatches (e.g., `FleetGlance` or `AgentList` needing new props).

- [ ] **Step 3: Run all tests**

```bash
npm test -- --run
```
Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/views/AgentsViewV2.tsx
git commit -m "feat(agents): AgentsViewV2 — three-pane orchestrator wired with Inspector"
```

---

## Task 11: CSS cleanup + token migration

**Goal:** Eliminate all `--fleet-*` references from agents CSS/TSX files. Reduce aggregate `agents/*.css` from 2083 lines to under 1041 (≥50% reduction).

- [ ] **Step 1: Audit remaining --fleet-* references in agents files**

```bash
grep -rn "\-\-fleet-" src/renderer/src/components/agents/ src/renderer/src/views/AgentsView*.tsx 2>/dev/null | grep -v ".test." | grep -v ".css.map"
```
Record every occurrence.

- [ ] **Step 2: Audit text-gradient-aurora and glow effects**

```bash
grep -rn "text-gradient-aurora\|glow\|aurora\|scanline\|neonVar\|NeonCard\|NeonBadge" src/renderer/src/components/agents/ src/renderer/src/views/AgentsView*.tsx 2>/dev/null | grep -v ".test."
```

- [ ] **Step 3: Replace each --fleet-* token with V2 equivalent**

Token mapping:
```
--fleet-bg            → --bg
--fleet-surface       → --surf-1
--fleet-surface-2     → --surf-2
--fleet-border        → --line
--fleet-text          → --fg
--fleet-text-dim      → --fg-2
--fleet-text-muted    → --fg-3
--fleet-accent        → --accent
--fleet-accent-fg     → --accent-fg
--fleet-accent-surface → --accent-soft
--fleet-accent-border → --accent-line
--fleet-status-active → --st-running
--fleet-status-review → --st-review
--fleet-status-done   → --st-done
--fleet-status-failed → --st-failed
--fleet-danger        → --st-failed
--fleet-danger-border → color-mix(in oklch, var(--st-failed) 30%, transparent)
--fleet-radius-full   → --r-xl
--fleet-space-3       → --s-3
```

Edit each file that has matches and replace in-place.

- [ ] **Step 4: Remove NeonCard/NeonBadge/neonVar imports from agents files**

Any remaining import of `NeonCard`, `NeonBadge`, or `neonVar` inside `components/agents/` should be removed (these are V1 neon primitives). Note: `AgentCard.tsx` still uses them for backward compat with V1 — leave it as-is since AgentsViewV1 still uses it.

- [ ] **Step 5: Minimize CSS files that are now redundant**

Files that are now fully inline-styled can be reduced to empty or minimal. Specifically:
- `AgentList.css` — should be near empty
- `FleetGlance.css` — should be near empty
- `AgentLaunchpad.css` — empty (was 2 lines)
- `LaunchpadGrid.css` — minimize to max 30 lines
- `AgentConsole.css` — should be under 60 lines (from 153)
- `AgentConsoleHeader.css` — empty or minimal
- `ConsoleLine.css` — keep as-is (used by ConsoleCard/ConsoleLine rendering)
- `CommandBar.css` — minimize: keep textarea + autocomplete styles, remove glow effects

- [ ] **Step 6: Count lines**

```bash
wc -l src/renderer/src/components/agents/*.css | sort -n
```
Expected: total under 1041. If not, continue removing dead CSS rules.

- [ ] **Step 7: Run all tests + typecheck**

```bash
npm run typecheck && npm test -- --run
```
Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/agents/*.css src/renderer/src/components/agents/*.tsx src/renderer/src/views/AgentsViewV2.tsx
git commit -m "chore(agents): CSS cleanup — remove --fleet-* tokens, reduce agents CSS by ≥50%"
```

---

## Task 12: Tests + module documentation

**Files:**
- Modify: various `__tests__/` files (snapshot updates)
- Modify: `docs/modules/components/index.md`
- Create: `docs/modules/components/agents/AgentInspector.md`
- Create: `docs/modules/components/agents/AgentRow.md`

- [ ] **Step 1: Update all agent snapshot tests**

Run the full suite and update snapshots that changed due to chrome refactoring:

```bash
npm test -- --run -u
```

Review the diff carefully. Verify:
- Behavioral assertions still exist (keyboard shortcuts, IPC calls, state changes)
- Only snapshot / style assertions were updated
- No test was deleted

- [ ] **Step 2: Run the full test suite to confirm green**

```bash
npm test -- --run
```
Expected: all green.

- [ ] **Step 3: Run main process tests**

```bash
npm run test:main
```
Expected: all green.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: zero errors.

- [ ] **Step 5: Update `docs/modules/components/index.md`**

Add rows for every new or modified file in `components/agents/`:

| Module | Group | Purpose |
|--------|-------|---------|
| `AgentRow` | agents | V2 row — status dot/pulse, id, step, progress bar |
| `AgentInspector` | agents | Inspector pane — 6 sections for Console mode |
| `AgentConsoleStream` | agents | Virtual-scroll stream extracted from AgentConsole |
| `AgentComposer` | agents | V2 composer wrapping CommandBar |
| `AgentConsoleHeader` | agents | V2 48px header (renamed from ConsoleHeader) |
| `ScratchpadBanner` | agents | Dismissable scratchpad explainer banner |

Update existing rows for `AgentList`, `AgentConsole`, `AgentLaunchpad`, `FleetGlance`, `LaunchpadGrid`.

- [ ] **Step 6: Create `docs/modules/components/agents/AgentInspector.md`**

```markdown
# AgentInspector

**Layer:** renderer/components
**Source:** `src/renderer/src/components/agents/AgentInspector.tsx`

## Purpose
Six-section read-only pane showing details for the selected agent in Console mode: task prompt, task spec, worktree info, files touched, run metrics (sparkline + MiniStat grid), and recent event timeline.

## Public API
- `AgentInspector({ agent, events })` — accepts `AgentMeta` and `AgentEvent[]`

## Key Dependencies
- `MiniStat` from `components/sprint/primitives/MiniStat.tsx` — metric tiles
- `MicroSpark` from `components/dashboard/primitives/MicroSpark.tsx` — token sparkline
- `useAgentEventsStore` — event stream for timeline and file derivation
```

- [ ] **Step 7: Create `docs/modules/components/agents/AgentRow.md`**

```markdown
# AgentRow

**Layer:** renderer/components
**Source:** `src/renderer/src/components/agents/AgentRow.tsx`

## Purpose
V2 list row for FleetList. Three-line layout: (1) status indicator + agent id + age, (2) repo prefix + current step, (3) running progress bar. Uses `.fleet-pulse` for running agents and `.fleet-dot--{status}` for terminal agents.

## Public API
- `AgentRow({ agent, selected, onClick, currentStep?, progressPct? })` — pure presentational row

## Key Dependencies
- `timeAgo` from `lib/format.ts`
```

- [ ] **Step 8: Final commit**

```bash
git add docs/modules/ src/renderer/src/components/agents/__tests__/
git commit -m "docs(agents): update module docs for Phase 5 V2 Agents view"
```

---

## Self-Review

**Spec coverage check:**
- §1 Three-pane layout → Tasks 1 + 10 ✓
- §2 FleetList (header, composition strip, filter chips, search, rows, states) → Tasks 2 + 3 ✓
- §3 Console pane (header, stream, composer) → Tasks 4 + 5 + 6 ✓
- §4 Launchpad (center-column form, task spec/prompt distinction) → Task 8 ✓
- §5 Glance (header, tile grid, metrics) → Task 9 ✓
- §6 Inspector (six sections) → Task 7 ✓
- §7 Narrow viewport behavior (<1280px slide-over) → Task 10 ✓
- §8 Pulse Rule (FleetList rows, Glance tiles, stream current-step) → Tasks 2, 5, 9 ✓
- §9 Banners — ScratchpadBanner only → Task 2 ✓
- §12 CSS ≥50% reduction → Task 11 ✓
- §13 TODO(verify) items → rendered as placeholders with comments in Tasks 7, 8 ✓
- §15 Acceptance criteria 1-16 → all covered ✓

**TODO(verify) items flagged for PR body:**
1. Task prompt storage: `agent.task` used as placeholder; confirm where spawn-time prompt lives on `AgentMeta`
2. Promote-to-Code-Review as primary action: `canPromote` logic preserved from V1
3. Slash command registry: CommandBar chips are placeholder `/plan /test /commit @` — replace with `useAgentSlashCommands` output
4. Filter chip wiring: `activeFilter` drives visual state; confirm `useAgentHistoryStore` has a filter selector (if not, chips are visual-only with TODO comment)
5. Inspector event mapping: `mapEventToStatus` function — verify actual event types emitted by `useAgentEventsStore`

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-05-agents-view-v2.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks

**2. Inline Execution** — execute tasks in this session using executing-plans

**Which approach?**
