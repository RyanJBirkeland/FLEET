# V2 Planner Stubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the three "coming soon" stubs in `PlannerViewV2` — a Dependencies tab for managing epic-to-epic dependencies, an Activity tab showing a unified feed of agent events + task audit changes, and inline click-to-edit for epic name and goal in `PlEpicHero`.

**Architecture:** Three new components (`PlDepsPane`, `PlActivityFeed`) and one new hook (`usePlActivityFeed`) slot into the existing `PlEpicCanvas` tab panel. Inline editing is added directly to `PlEpicHero` using local `useState`; the `onEditEpic` prop is removed across the chain (Hero → Canvas → PlannerViewV2). All required IPC channels and store methods already exist.

**Tech Stack:** React + TypeScript, Zustand (`useTaskGroups`), existing IPC (`sprint:getChanges`, `groups:addDependency`, etc.), `subscribeToAgentEvents` from `services/agents.ts`, `timeAgo` from `lib/format.ts`.

---

## File Map

| File | Role |
|---|---|
| `src/renderer/src/components/planner/v2/PlDepsPane.tsx` | **New** — Dependencies tab: list + add + remove + cycle condition |
| `src/renderer/src/components/planner/v2/__tests__/PlDepsPane.test.ts` | **New** — unit tests for `nextDependencyCondition` |
| `src/renderer/src/components/planner/v2/hooks/usePlActivityFeed.ts` | **New** — data fetching + merge hook for Activity tab |
| `src/renderer/src/components/planner/v2/hooks/__tests__/usePlActivityFeed.test.ts` | **New** — unit tests for `agentEventSummary`, `buildAgentFeedEntry`, `buildChangeFeedEntry` |
| `src/renderer/src/components/planner/v2/PlActivityFeed.tsx` | **New** — Activity tab component |
| `src/renderer/src/components/planner/v2/PlEpicCanvas.tsx` | **Modify** — wire PlDepsPane + PlActivityFeed; remove `onEditEpic` prop |
| `src/renderer/src/components/planner/v2/PlEpicHero.tsx` | **Modify** — inline edit for name + goal; remove `onEditEpic` prop |
| `src/renderer/src/components/planner/v2/PlannerViewV2.tsx` | **Modify** — remove `handleEditEpic` + `onEditEpic` passthrough |
| `docs/modules/components/index.md` | **Modify** — add rows for new planner/v2 components |

---

### Task 1: `PlDepsPane` — Dependencies tab

**Files:**
- Create: `src/renderer/src/components/planner/v2/PlDepsPane.tsx`
- Create: `src/renderer/src/components/planner/v2/__tests__/PlDepsPane.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/components/planner/v2/__tests__/PlDepsPane.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nextDependencyCondition } from '../PlDepsPane'

describe('nextDependencyCondition', () => {
  it('cycles on_success → always', () => {
    expect(nextDependencyCondition('on_success')).toBe('always')
  })

  it('cycles always → manual', () => {
    expect(nextDependencyCondition('always')).toBe('manual')
  })

  it('cycles manual → on_success', () => {
    expect(nextDependencyCondition('manual')).toBe('on_success')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/renderer/src/components/planner/v2/__tests__/PlDepsPane.test.ts
```

Expected: FAIL — "Cannot find module '../PlDepsPane'"

- [ ] **Step 3: Create `PlDepsPane.tsx`**

```tsx
import { useState } from 'react'
import type { TaskGroup, EpicDependency } from '../../../../../shared/types'
import { useTaskGroups } from '../../../stores/taskGroups'

interface PlDepsPaneProps {
  epic: TaskGroup
}

const CONDITION_LABEL: Record<EpicDependency['condition'], string> = {
  on_success: 'on success',
  always: 'always',
  manual: 'manual'
}

export function nextDependencyCondition(
  current: EpicDependency['condition']
): EpicDependency['condition'] {
  if (current === 'on_success') return 'always'
  if (current === 'always') return 'manual'
  return 'on_success'
}

export function PlDepsPane({ epic }: PlDepsPaneProps): React.JSX.Element {
  const { groups, addDependency, removeDependency, updateDependencyCondition } = useTaskGroups()
  const [cycleError, setCycleError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const deps = epic.depends_on ?? []
  const epicLookup = new Map(groups.map((g) => [g.id, g]))
  const addableEpics = groups
    .filter((g) => g.id !== epic.id && !deps.some((d) => d.id === g.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function handleCycleCondition(dep: EpicDependency): Promise<void> {
    setCycleError(null)
    try {
      await updateDependencyCondition(epic.id, dep.id, nextDependencyCondition(dep.condition))
    } catch (err) {
      setCycleError((err as Error).message)
    }
  }

  async function handleRemove(upstreamId: string): Promise<void> {
    setCycleError(null)
    await removeDependency(epic.id, upstreamId)
  }

  async function handleAdd(upstreamId: string): Promise<void> {
    setCycleError(null)
    setAdding(true)
    try {
      await addDependency(epic.id, { id: upstreamId, condition: 'on_success' })
    } catch {
      setCycleError('Adding this dependency would create a cycle.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      style={{
        padding: '20px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        overflowY: 'auto',
        flex: 1
      }}
    >
      {deps.length === 0 && addableEpics.length === 0 && (
        <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>
          No dependencies — this epic runs independently.
        </span>
      )}

      {deps.map((dep) => {
        const upstream = epicLookup.get(dep.id)
        return (
          <div
            key={dep.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: 'var(--surf-1)',
              border: '1px solid var(--line)',
              borderRadius: 6
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: upstream ? 'var(--fg)' : 'var(--fg-4)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {upstream ? upstream.name : dep.id}
            </span>
            <button
              onClick={() => void handleCycleCondition(dep)}
              title="Click to change condition"
              style={{
                height: 22,
                padding: '0 8px',
                border: '1px solid var(--line)',
                borderRadius: 999,
                background: 'transparent',
                fontSize: 11,
                color: 'var(--fg-2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                flexShrink: 0
              }}
            >
              {CONDITION_LABEL[dep.condition]}
            </button>
            <button
              onClick={() => void handleRemove(dep.id)}
              aria-label="Remove dependency"
              style={{
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                color: 'var(--fg-3)',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                flexShrink: 0
              }}
            >
              ×
            </button>
          </div>
        )
      })}

      {cycleError && (
        <span style={{ fontSize: 11, color: 'var(--st-failed)' }}>{cycleError}</span>
      )}

      {addableEpics.length > 0 && (
        <select
          defaultValue=""
          disabled={adding}
          onChange={(e) => {
            const val = e.target.value
            if (val) {
              void handleAdd(val)
              e.target.value = ''
            }
          }}
          style={{
            marginTop: 4,
            height: 30,
            padding: '0 8px',
            border: '1px solid var(--line)',
            borderRadius: 6,
            background: 'var(--surf-1)',
            color: 'var(--fg-2)',
            fontSize: 12,
            cursor: adding ? 'not-allowed' : 'pointer'
          }}
        >
          <option value="" disabled>
            + Add dependency…
          </option>
          {addableEpics.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm 3 pass**

```bash
npx vitest run src/renderer/src/components/planner/v2/__tests__/PlDepsPane.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Wire into `PlEpicCanvas.tsx`**

Add import at the top of `PlEpicCanvas.tsx`:
```tsx
import { PlDepsPane } from './PlDepsPane'
```

Replace the `activeTab !== 'Tasks'` branch with a switch so Dependencies gets its own panel. Replace this block:

```tsx
      ) : (
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>{activeTab} — coming soon</span>
        </div>
      )}
```

With:

```tsx
      ) : activeTab === 'Dependencies' ? (
        <div
          role="tabpanel"
          id="tabpanel-Dependencies"
          aria-labelledby="tab-Dependencies"
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <PlDepsPane epic={epic} />
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>{activeTab} — coming soon</span>
        </div>
      )}
```

- [ ] **Step 6: Run typecheck + full tests**

```bash
npm run typecheck && npx vitest run
```

Expected: zero errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/planner/v2/PlDepsPane.tsx \
        src/renderer/src/components/planner/v2/__tests__/PlDepsPane.test.ts \
        src/renderer/src/components/planner/v2/PlEpicCanvas.tsx
git commit -m "feat(planner): PlDepsPane — Dependencies tab with add/remove/cycle"
```

---

### Task 2: `usePlActivityFeed` hook

**Files:**
- Create: `src/renderer/src/components/planner/v2/hooks/usePlActivityFeed.ts`
- Create: `src/renderer/src/components/planner/v2/hooks/__tests__/usePlActivityFeed.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/src/components/planner/v2/hooks/__tests__/usePlActivityFeed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  agentEventSummary,
  buildAgentFeedEntry,
  buildChangeFeedEntry
} from '../usePlActivityFeed'
import type { AgentEvent } from '../../../../../../shared/types'

describe('agentEventSummary', () => {
  it('returns "Agent started" for agent:started', () => {
    const e: AgentEvent = { type: 'agent:started', model: 'claude', timestamp: 0 }
    expect(agentEventSummary(e)).toBe('Agent started')
  })

  it('returns "Agent completed" for agent:completed', () => {
    const e: AgentEvent = {
      type: 'agent:completed',
      exitCode: 0,
      costUsd: 0.1,
      tokensIn: 100,
      tokensOut: 50,
      durationMs: 5000,
      timestamp: 0
    }
    expect(agentEventSummary(e)).toBe('Agent completed')
  })

  it('formats agent:tool_call with $ prefix', () => {
    const e: AgentEvent = {
      type: 'agent:tool_call',
      tool: 'Read',
      summary: 'src/foo.ts',
      timestamp: 0
    }
    expect(agentEventSummary(e)).toBe('$ Read: src/foo.ts')
  })

  it('truncates agent:tool_call at 60 chars', () => {
    const e: AgentEvent = {
      type: 'agent:tool_call',
      tool: 'Bash',
      summary: 'x'.repeat(70),
      timestamp: 0
    }
    expect(agentEventSummary(e).length).toBeLessThanOrEqual(60)
  })

  it('returns error message for agent:error', () => {
    const e: AgentEvent = { type: 'agent:error', message: 'auth failed', timestamp: 0 }
    expect(agentEventSummary(e)).toBe('auth failed')
  })

  it('truncates agent:error message at 80 chars', () => {
    const e: AgentEvent = { type: 'agent:error', message: 'e'.repeat(100), timestamp: 0 }
    expect(agentEventSummary(e).length).toBe(80)
  })
})

describe('buildAgentFeedEntry', () => {
  it('returns null for non-tracked event types', () => {
    const e: AgentEvent = { type: 'agent:text', text: 'hello', timestamp: 0 }
    expect(buildAgentFeedEntry(e, 't1', 'Task 1')).toBeNull()
  })

  it('converts timestamp from ms to ISO string', () => {
    const e: AgentEvent = { type: 'agent:started', model: 'claude', timestamp: 1000 }
    const entry = buildAgentFeedEntry(e, 't1', 'Task 1')
    expect(entry?.timestamp).toBe(new Date(1000).toISOString())
  })

  it('sets taskId and taskTitle correctly', () => {
    const e: AgentEvent = { type: 'agent:started', model: 'claude', timestamp: 0 }
    const entry = buildAgentFeedEntry(e, 't1', 'My Task')
    expect(entry?.taskId).toBe('t1')
    expect(entry?.taskTitle).toBe('My Task')
    expect(entry?.kind).toBe('agent')
  })
})

describe('buildChangeFeedEntry', () => {
  it('maps all fields from a change row', () => {
    const row = {
      id: 1,
      task_id: 't1',
      field: 'status',
      old_value: 'queued',
      new_value: 'active',
      changed_by: 'system',
      changed_at: '2026-01-01T00:00:00.000Z'
    }
    const entry = buildChangeFeedEntry(row, 'My Task')
    expect(entry.kind).toBe('change')
    expect(entry.taskId).toBe('t1')
    expect(entry.taskTitle).toBe('My Task')
    expect(entry.field).toBe('status')
    expect(entry.oldValue).toBe('queued')
    expect(entry.newValue).toBe('active')
    expect(entry.changedBy).toBe('system')
    expect(entry.timestamp).toBe('2026-01-01T00:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/renderer/src/components/planner/v2/hooks/__tests__/usePlActivityFeed.test.ts
```

Expected: FAIL — "Cannot find module '../usePlActivityFeed'"

- [ ] **Step 3: Create `usePlActivityFeed.ts`**

Create `src/renderer/src/components/planner/v2/hooks/usePlActivityFeed.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'
import type { SprintTask, AgentEvent } from '../../../../../../shared/types'
import { subscribeToAgentEvents, getAgentEventHistory } from '../../../../services/agents'

type TrackedEventType = 'agent:started' | 'agent:completed' | 'agent:error' | 'agent:tool_call'

const TRACKED_EVENTS = new Set<string>([
  'agent:started',
  'agent:completed',
  'agent:error',
  'agent:tool_call'
])

interface ChangeRow {
  id: number
  task_id: string
  field: string
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
}

export type FeedEntry =
  | {
      kind: 'change'
      taskId: string
      taskTitle: string
      field: string
      oldValue: string | null
      newValue: string | null
      changedBy: string
      timestamp: string
    }
  | {
      kind: 'agent'
      taskId: string
      taskTitle: string
      eventType: TrackedEventType
      summary: string
      timestamp: string
    }

export function agentEventSummary(event: AgentEvent): string {
  if (event.type === 'agent:started') return 'Agent started'
  if (event.type === 'agent:completed') return 'Agent completed'
  if (event.type === 'agent:error') return event.message.slice(0, 80)
  if (event.type === 'agent:tool_call') return `$ ${event.tool}: ${event.summary}`.slice(0, 60)
  return ''
}

export function buildAgentFeedEntry(
  event: AgentEvent,
  taskId: string,
  taskTitle: string
): FeedEntry | null {
  if (!TRACKED_EVENTS.has(event.type)) return null
  return {
    kind: 'agent',
    taskId,
    taskTitle,
    eventType: event.type as TrackedEventType,
    summary: agentEventSummary(event),
    timestamp: new Date(event.timestamp).toISOString()
  }
}

export function buildChangeFeedEntry(row: ChangeRow, taskTitle: string): FeedEntry {
  return {
    kind: 'change',
    taskId: row.task_id,
    taskTitle,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedBy: row.changed_by,
    timestamp: row.changed_at
  }
}

function sortNewestFirst(entries: FeedEntry[]): FeedEntry[] {
  return [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export function usePlActivityFeed(tasks: SprintTask[]): {
  entries: FeedEntry[]
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (tasks.length === 0) {
      setEntries([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const perTask = await Promise.all(
        tasks.map(async (task) => {
          const [changes, agentEvents] = await Promise.all([
            window.api.sprint.getChanges(task.id),
            getAgentEventHistory(task.id)
          ])
          const changeEntries = changes.map((c) => buildChangeFeedEntry(c as ChangeRow, task.title))
          const agentEntries = agentEvents
            .map((e) => buildAgentFeedEntry(e, task.id, task.title))
            .filter((e): e is FeedEntry => e !== null)
          return [...changeEntries, ...agentEntries]
        })
      )
      setEntries(sortNewestFirst(perTask.flat()))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [tasks])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const taskIds = new Set(tasks.map((t) => t.id))
    const titleByTaskId = new Map(tasks.map((t) => [t.id, t.title]))

    const unsubscribe = subscribeToAgentEvents(({ agentId, event }) => {
      if (!taskIds.has(agentId)) return
      const entry = buildAgentFeedEntry(event, agentId, titleByTaskId.get(agentId) ?? agentId)
      if (!entry) return
      setEntries((prev) => sortNewestFirst([entry, ...prev]))
    })

    return unsubscribe
  }, [tasks])

  return { entries, loading, error, reload: fetchAll }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/renderer/src/components/planner/v2/hooks/__tests__/usePlActivityFeed.test.ts
```

Expected: PASS (9 tests)

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: zero errors

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/planner/v2/hooks/usePlActivityFeed.ts \
        src/renderer/src/components/planner/v2/hooks/__tests__/usePlActivityFeed.test.ts
git commit -m "feat(planner): usePlActivityFeed hook — merged agent events + task audit feed"
```

---

### Task 3: `PlActivityFeed` + wire Activity tab

**Files:**
- Create: `src/renderer/src/components/planner/v2/PlActivityFeed.tsx`
- Modify: `src/renderer/src/components/planner/v2/PlEpicCanvas.tsx`

- [ ] **Step 1: Create `PlActivityFeed.tsx`**

```tsx
import type { SprintTask } from '../../../../../shared/types'
import { usePlActivityFeed, type FeedEntry } from './hooks/usePlActivityFeed'
import { timeAgo } from '../../../lib/format'

interface PlActivityFeedProps {
  tasks: SprintTask[]
}

const DOT_COLOR: Record<string, string> = {
  'agent:started': 'var(--st-running)',
  'agent:completed': 'var(--st-done)',
  'agent:error': 'var(--st-failed)',
  'agent:tool_call': 'var(--fg-4)',
  change: 'var(--fg-3)'
}

function entryColor(entry: FeedEntry): string {
  if (entry.kind === 'change') return DOT_COLOR.change
  return DOT_COLOR[entry.eventType] ?? 'var(--fg-4)'
}

function entryDescription(entry: FeedEntry): string {
  if (entry.kind === 'agent') return entry.summary
  if (entry.field === 'status') return `status → ${entry.newValue ?? '?'}`
  return `${entry.field} updated`
}

export function PlActivityFeed({ tasks }: PlActivityFeedProps): React.JSX.Element {
  const { entries, loading, error, reload } = usePlActivityFeed(tasks)

  if (loading) {
    return (
      <div style={centeredStyle}>
        <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={centeredStyle}>
        <span style={{ fontSize: 12, color: 'var(--st-failed)' }}>{error}</span>
        <button
          onClick={reload}
          style={{
            marginTop: 8,
            fontSize: 12,
            color: 'var(--fg-2)',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 4,
            padding: '2px 10px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div style={centeredStyle}>
        <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>
          No activity yet for tasks in this epic.
        </span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 28px' }}>
      {entries.map((entry, i) => (
        <FeedRow key={`${entry.taskId}-${entry.timestamp}-${i}`} entry={entry} />
      ))}
    </div>
  )
}

function FeedRow({ entry }: { entry: FeedEntry }): React.JSX.Element {
  const color = entryColor(entry)
  const description = entryDescription(entry)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '7px 0',
        borderBottom: '1px solid var(--line)'
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
          marginTop: 5
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-3)',
            marginRight: 6
          }}
        >
          {entry.taskTitle}
        </span>
        <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{description}</span>
      </div>
      <span
        style={{
          fontSize: 11,
          color: 'var(--fg-4)',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0
        }}
      >
        {timeAgo(entry.timestamp)}
      </span>
    </div>
  )
}

const centeredStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center'
}
```

- [ ] **Step 2: Wire into `PlEpicCanvas.tsx`**

Add import:
```tsx
import { PlActivityFeed } from './PlActivityFeed'
```

In the tab panel area, extend the existing conditional to handle the `Activity` tab. Replace the `activeTab === 'Dependencies'` branch introduced in Task 1 to include Activity:

```tsx
      ) : activeTab === 'Dependencies' ? (
        <div
          role="tabpanel"
          id="tabpanel-Dependencies"
          aria-labelledby="tab-Dependencies"
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <PlDepsPane epic={epic} />
        </div>
      ) : activeTab === 'Activity' ? (
        <div
          role="tabpanel"
          id="tabpanel-Activity"
          aria-labelledby="tab-Activity"
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <PlActivityFeed tasks={tasks} />
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>{activeTab} — coming soon</span>
        </div>
      )}
```

- [ ] **Step 3: Run typecheck + tests**

```bash
npm run typecheck && npx vitest run
```

Expected: zero errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/planner/v2/PlActivityFeed.tsx \
        src/renderer/src/components/planner/v2/PlEpicCanvas.tsx
git commit -m "feat(planner): PlActivityFeed — unified agent events + task audit feed tab"
```

---

### Task 4: Inline epic edit in `PlEpicHero` + remove `onEditEpic`

**Files:**
- Modify: `src/renderer/src/components/planner/v2/PlEpicHero.tsx`
- Modify: `src/renderer/src/components/planner/v2/PlEpicCanvas.tsx`
- Modify: `src/renderer/src/components/planner/v2/PlannerViewV2.tsx`

- [ ] **Step 1: Rewrite `PlEpicHero.tsx`**

Replace the full file contents. The key changes are:
- Remove `onEditEpic` from Props
- Add `useTaskGroups` import and `updateGroup` store method
- Replace the plain `name` `<div>` with `<EditableText>`
- Replace the plain `goal` `<div>` with `<EditableTextarea>`
- Remove the "Edit epic" button

```tsx
import { useMemo, useState, useRef, useEffect } from 'react'
import type { TaskGroup, SprintTask } from '../../../../../shared/types'
import { useTaskGroups } from '../../../stores/taskGroups'
import { EpicIcon } from './PlEpicRail'
import { partitionSprintTasks } from '../../../lib/partitionSprintTasks'

interface Props {
  epic: TaskGroup
  tasks: SprintTask[]
  onToggleReady: () => void
}

const STATUS_LABEL: Record<TaskGroup['status'], string> = {
  ready: 'Ready to queue',
  'in-pipeline': 'In pipeline',
  draft: 'Draft',
  completed: 'Completed'
}

export function PlEpicHero({ epic, tasks, onToggleReady }: Props): React.JSX.Element {
  const { updateGroup } = useTaskGroups()

  const counts = useMemo(() => {
    const c = { done: 0, running: 0, queued: 0, blocked: 0 }
    tasks.forEach((t) => {
      if (t.status === 'done') c.done++
      else if (t.status === 'active') c.running++
      else if (t.status === 'queued') c.queued++
      else if (t.status === 'blocked') c.blocked++
    })
    return c
  }, [tasks])
  const backlogCount = useMemo(() => partitionSprintTasks(tasks).backlog.length, [tasks])
  const { done: doneCount, running: runningCount, queued: queuedCount, blocked: blockedCount } =
    counts

  async function saveName(name: string): Promise<void> {
    const trimmed = name.trim()
    if (trimmed && trimmed !== epic.name) {
      await updateGroup(epic.id, { name: trimmed })
    }
  }

  async function saveGoal(goal: string): Promise<void> {
    const trimmed = goal.trim()
    if (trimmed !== (epic.goal ?? '')) {
      await updateGroup(epic.id, { goal: trimmed || undefined })
    }
  }

  return (
    <div
      style={{
        padding: '20px 28px 18px',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        flexShrink: 0
      }}
    >
      <EpicIcon icon={epic.icon} accent={epic.accent_color} size={44} fontSize={18} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            {epic.id}
          </span>
          <span style={{ width: 3, height: 3, background: 'var(--fg-4)', borderRadius: 2 }} />
          <span
            style={{
              fontSize: 11,
              color: 'var(--fg-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}
          >
            {STATUS_LABEL[epic.status]}
          </span>
          {epic.is_paused && (
            <>
              <span style={{ width: 3, height: 3, background: 'var(--fg-4)', borderRadius: 2 }} />
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--st-blocked)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                paused
              </span>
            </>
          )}
        </div>

        <EditableText
          value={epic.name}
          onSave={saveName}
          style={{
            marginTop: 4,
            fontSize: 22,
            fontWeight: 500,
            color: 'var(--fg)',
            letterSpacing: '-0.01em'
          }}
        />

        <EditableTextarea
          value={epic.goal ?? ''}
          placeholder="Add a goal…"
          onSave={saveGoal}
          style={{
            marginTop: 6,
            fontSize: 13,
            color: 'var(--fg-2)',
            lineHeight: 1.5,
            maxWidth: 720
          }}
        />

        <div style={{ marginTop: 14, display: 'flex', gap: 18, alignItems: 'center' }}>
          <ProgressDot label="done" count={doneCount} dotClass="done" />
          <ProgressDot label="running" count={runningCount} dotClass="running" />
          <ProgressDot label="queued" count={queuedCount} dotClass="queued" />
          <ProgressDot label="blocked" count={blockedCount} dotClass="blocked" />
          <ProgressDot label="backlog" count={backlogCount} dotClass="queued" muted />

          <span style={{ flex: 1 }} />

          <button
            onClick={onToggleReady}
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--fg-2)',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            {epic.status === 'ready' ? 'Unmark ready' : 'Mark ready'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditableText({
  value,
  onSave,
  style
}: {
  value: string
  onSave: (v: string) => Promise<void>
  style?: React.CSSProperties
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  // Keep draft in sync when epic changes externally
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  function startEdit(): void {
    setDraft(value)
    setEditing(true)
  }

  async function commit(): Promise<void> {
    setEditing(false)
    await onSave(draft)
  }

  function cancel(): void {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void commit() }
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        style={{
          ...style,
          display: 'block',
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--accent)',
          outline: 'none',
          padding: '0 0 2px',
          fontFamily: 'inherit'
        }}
      />
    )
  }

  return (
    <div
      onClick={startEdit}
      title="Click to edit"
      style={{
        ...style,
        cursor: 'text',
        borderBottom: '1px solid transparent',
        paddingBottom: 2
      }}
    >
      {value}
    </div>
  )
}

function EditableTextarea({
  value,
  placeholder,
  onSave,
  style
}: {
  value: string
  placeholder?: string
  onSave: (v: string) => Promise<void>
  style?: React.CSSProperties
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [editing, draft])

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  function startEdit(): void {
    setDraft(value)
    setEditing(true)
  }

  async function commit(): Promise<void> {
    setEditing(false)
    await onSave(draft)
  }

  function cancel(): void {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        autoFocus
        onChange={(e) => {
          setDraft(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = `${e.target.scrollHeight}px`
        }}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        style={{
          ...style,
          display: 'block',
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--accent)',
          outline: 'none',
          padding: '0 0 2px',
          fontFamily: 'inherit',
          resize: 'none',
          overflow: 'hidden'
        }}
      />
    )
  }

  return (
    <div
      onClick={startEdit}
      title="Click to edit"
      style={{
        ...style,
        cursor: 'text',
        borderBottom: '1px solid transparent',
        paddingBottom: 2,
        color: value ? style?.color : 'var(--fg-4)'
      }}
    >
      {value || placeholder}
    </div>
  )
}

function ProgressDot({
  label,
  count,
  dotClass,
  muted
}: {
  label: string
  count: number
  dotClass: string
  muted?: boolean
}): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        className={`fleet-dot fleet-dot--${dotClass}`}
        style={muted ? { opacity: 0.4 } : undefined}
      />
      <span
        style={{
          fontSize: 12,
          color: 'var(--fg)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 500
        }}
      >
        {count}
      </span>
      <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{label}</span>
    </span>
  )
}
```

- [ ] **Step 2: Update `PlEpicCanvas.tsx` — remove `onEditEpic` prop**

In `PlEpicCanvas.tsx`:

Remove `onEditEpic: () => void` from the `Props` interface.

Remove `onEditEpic,` from the destructured props.

Change the `PlEpicHero` call from:
```tsx
      <PlEpicHero epic={epic} tasks={tasks} onEditEpic={onEditEpic} onToggleReady={onToggleReady} />
```
to:
```tsx
      <PlEpicHero epic={epic} tasks={tasks} onToggleReady={onToggleReady} />
```

- [ ] **Step 3: Update `PlannerViewV2.tsx` — remove `handleEditEpic` and `onEditEpic`**

Delete the entire `handleEditEpic` callback (lines ~63–69 in the current file):
```tsx
  const handleEditEpic = useCallback(async () => {
    if (!selectedGroup) return
    toast.info('Use the overflow menu on the epic to edit its name and goal.')
  }, [selectedGroup])
```

Also remove the `toast` import if it is now unused (check for other usages first).

Remove `onEditEpic={handleEditEpic}` from the `<PlEpicCanvas ... />` JSX.

- [ ] **Step 4: Run typecheck + tests**

```bash
npm run typecheck && npx vitest run
```

Expected: zero type errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/planner/v2/PlEpicHero.tsx \
        src/renderer/src/components/planner/v2/PlEpicCanvas.tsx \
        src/renderer/src/components/planner/v2/PlannerViewV2.tsx
git commit -m "feat(planner): inline edit for epic name + goal in PlEpicHero; remove onEditEpic"
```

---

### Task 5: Module docs + final checks

**Files:**
- Modify: `docs/modules/components/index.md`

- [ ] **Step 1: Add rows for new components and hook**

In `docs/modules/components/index.md`, under the `planner` group, add rows for:
- `PlDepsPane.tsx` — Dependencies tab: list/add/remove epic dependencies with condition cycling
- `PlActivityFeed.tsx` — Activity tab: unified feed of agent events + task field-change audit
- `hooks/usePlActivityFeed.ts` — Data hook for PlActivityFeed: fetches task changes + agent history, subscribes to live events

Update the existing `PlEpicHero.tsx` row to note inline editing for name and goal.

- [ ] **Step 2: Run full suite**

```bash
npm run typecheck && npx vitest run && npm run lint
```

Expected: zero errors, all tests pass, zero lint errors

- [ ] **Step 3: Commit**

```bash
git add docs/modules/
git commit -m "docs: module index updates for V2 Planner stubs"
```
