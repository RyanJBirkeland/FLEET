# Spec Diff Viewer — Epic Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an inline before/after diff on `update-spec` action cards in the Epic Assistant so users can see what changed before clicking Apply, plus an "Apply All" batch button when a message has 2+ pending spec updates.

**Architecture:** Extract `buildSyntheticDiff` from `EditDiffCard.tsx` to a shared util. New `SpecDiffViewer` component uses that util + `parseDiff` (already in `diff-parser.ts`) to render collapsed/expandable diffs using existing CSS tokens. `PlannerAssistantInner` looks up each task's current spec from the `tasks` prop and passes it to `ActionCard`. All changes are renderer-only.

**Tech Stack:** React, TypeScript, Vitest, @testing-library/react, existing `parseDiff` + `DiffFile` from `src/renderer/src/lib/diff-parser.ts`, existing CSS tokens `--fleet-diff-add-bg` / `--fleet-diff-del-bg`.

---

## File Map

| File | Change |
|---|---|
| `src/renderer/src/lib/spec-diff.ts` | New — exports `buildSyntheticDiff` |
| `src/renderer/src/lib/__tests__/spec-diff.test.ts` | New — unit tests for the helper |
| `src/renderer/src/components/agents/cards/EditDiffCard.tsx` | Modify — import from shared util, remove local copy |
| `src/renderer/src/components/planner/SpecDiffViewer.tsx` | New — collapsed/expandable diff component |
| `src/renderer/src/components/planner/SpecDiffViewer.css` | New — scoped styles |
| `src/renderer/src/components/planner/SpecDiffViewer.test.tsx` | New — component tests |
| `src/renderer/src/components/planner/PlannerAssistant.tsx` | Modify — wire `oldSpec`, render `SpecDiffViewer`, add "Apply All" |
| `src/renderer/src/components/planner/__tests__/PlannerAssistant.test.tsx` | Modify — extend with diff + Apply All tests |

---

### Task 1: Extract `buildSyntheticDiff` to shared util

**Files:**
- Create: `src/renderer/src/lib/spec-diff.ts`
- Create: `src/renderer/src/lib/__tests__/spec-diff.test.ts`
- Modify: `src/renderer/src/components/agents/cards/EditDiffCard.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/src/lib/__tests__/spec-diff.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildSyntheticDiff } from '../spec-diff'

describe('buildSyntheticDiff', () => {
  it('produces a valid unified diff header', () => {
    const result = buildSyntheticDiff('spec.md', 'old line', 'new line')
    expect(result).toContain('diff --git a/spec.md b/spec.md')
    expect(result).toContain('--- a/spec.md')
    expect(result).toContain('+++ b/spec.md')
    expect(result).toContain('@@ -1,1 +1,1 @@')
  })

  it('marks old lines with - and new lines with +', () => {
    const result = buildSyntheticDiff('spec.md', 'removed', 'added')
    expect(result).toContain('-removed')
    expect(result).toContain('+added')
  })

  it('handles empty old string (all additions)', () => {
    const result = buildSyntheticDiff('spec.md', '', 'new content')
    expect(result).toContain('-\n')   // one empty del line
    expect(result).toContain('+new content')
  })

  it('handles multi-line strings', () => {
    const old = '## Goal\nBuild auth'
    const next = '## Goal\nBuild OAuth2 auth\nwith refresh tokens'
    const result = buildSyntheticDiff('spec.md', old, next)
    expect(result).toContain('-## Goal')
    expect(result).toContain('+## Goal')
    expect(result).toContain('+with refresh tokens')
  })
})
```

- [ ] **Step 2: Run to confirm the tests fail**

```bash
npm test -- --run src/renderer/src/lib/__tests__/spec-diff.test.ts
```

Expected: FAIL — `buildSyntheticDiff` not found.

- [ ] **Step 3: Create `src/renderer/src/lib/spec-diff.ts`**

```typescript
/**
 * Builds a synthetic unified diff string suitable for `parseDiff()`.
 * Used by SpecDiffViewer and EditDiffCard to display before/after text comparisons.
 */
export function buildSyntheticDiff(filePath: string, oldStr: string, newStr: string): string {
  const oldLines = oldStr.split('\n')
  const newLines = newStr.split('\n')

  let diff = `diff --git a/${filePath} b/${filePath}\n`
  diff += `--- a/${filePath}\n`
  diff += `+++ b/${filePath}\n`
  diff += `@@ -1,${oldLines.length} +1,${newLines.length} @@\n`

  for (const line of oldLines) diff += `-${line}\n`
  for (const line of newLines) diff += `+${line}\n`

  return diff
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- --run src/renderer/src/lib/__tests__/spec-diff.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Update `EditDiffCard.tsx` to import from shared util**

In `src/renderer/src/components/agents/cards/EditDiffCard.tsx`:

At the top, add the import:
```typescript
import { buildSyntheticDiff } from '../../../lib/spec-diff'
```

Delete the local `buildSyntheticDiff` function (lines 8–27 — the function definition from `function buildSyntheticDiff(` to its closing `}`).

Run typecheck to verify no regressions:
```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/spec-diff.ts \
        src/renderer/src/lib/__tests__/spec-diff.test.ts \
        src/renderer/src/components/agents/cards/EditDiffCard.tsx
git commit -m "refactor(planner): extract buildSyntheticDiff to shared lib/spec-diff"
```

---

### Task 2: `SpecDiffViewer` component

**Files:**
- Create: `src/renderer/src/components/planner/SpecDiffViewer.tsx`
- Create: `src/renderer/src/components/planner/SpecDiffViewer.css`
- Create: `src/renderer/src/components/planner/SpecDiffViewer.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/src/components/planner/SpecDiffViewer.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpecDiffViewer } from './SpecDiffViewer'

describe('SpecDiffViewer', () => {
  it('renders collapsed by default with a show-changes button', () => {
    render(<SpecDiffViewer oldSpec="## Goal\nOld content" newSpec="## Goal\nNew content" />)
    expect(screen.getByRole('button', { name: /show changes/i })).toBeInTheDocument()
    expect(screen.queryByTestId('spec-diff-lines')).not.toBeInTheDocument()
  })

  it('expands when show-changes is clicked', async () => {
    render(<SpecDiffViewer oldSpec="## Goal\nOld content" newSpec="## Goal\nNew content" />)
    await userEvent.click(screen.getByRole('button', { name: /show changes/i }))
    expect(screen.getByTestId('spec-diff-lines')).toBeInTheDocument()
  })

  it('shows add and del line classes when expanded', async () => {
    render(<SpecDiffViewer oldSpec="removed line" newSpec="added line" />)
    await userEvent.click(screen.getByRole('button', { name: /show changes/i }))
    const lines = screen.getByTestId('spec-diff-lines')
    expect(lines.querySelector('.edit-diff-card__row--del')).toBeTruthy()
    expect(lines.querySelector('.edit-diff-card__row--add')).toBeTruthy()
  })

  it('collapses when hide-changes is clicked', async () => {
    render(<SpecDiffViewer oldSpec="old" newSpec="new" />)
    await userEvent.click(screen.getByRole('button', { name: /show changes/i }))
    await userEvent.click(screen.getByRole('button', { name: /hide changes/i }))
    expect(screen.queryByTestId('spec-diff-lines')).not.toBeInTheDocument()
  })

  it('renders all additions when oldSpec is null', async () => {
    render(<SpecDiffViewer oldSpec={null} newSpec="brand new spec line" />)
    await userEvent.click(screen.getByRole('button', { name: /show changes/i }))
    const lines = screen.getByTestId('spec-diff-lines')
    expect(lines.querySelector('.edit-diff-card__row--add')).toBeTruthy()
    expect(lines.querySelector('.edit-diff-card__row--del')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npm test -- --run src/renderer/src/components/planner/SpecDiffViewer.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create `SpecDiffViewer.tsx`**

Create `src/renderer/src/components/planner/SpecDiffViewer.tsx`:

```typescript
import { useState } from 'react'
import { buildSyntheticDiff } from '../../../lib/spec-diff'
import { parseDiff } from '../../../lib/diff-parser'
import './SpecDiffViewer.css'

interface SpecDiffViewerProps {
  oldSpec: string | null
  newSpec: string
}

export function SpecDiffViewer({ oldSpec, newSpec }: SpecDiffViewerProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const oldLines = (oldSpec ?? '').split('\n').length
  const newLines = newSpec.split('\n').length
  const addCount = newLines
  const delCount = oldSpec ? oldLines : 0

  const summaryLabel = `Show changes (+${addCount} / -${delCount})`

  if (!expanded) {
    return (
      <button
        type="button"
        className="spec-diff-viewer__toggle"
        onClick={() => setExpanded(true)}
        aria-label="Show changes"
      >
        {summaryLabel}
      </button>
    )
  }

  const raw = buildSyntheticDiff('spec.md', oldSpec ?? '', newSpec)
  const files = parseDiff(raw)

  return (
    <div className="spec-diff-viewer">
      <button
        type="button"
        className="spec-diff-viewer__toggle"
        onClick={() => setExpanded(false)}
        aria-label="Hide changes"
      >
        Hide changes
      </button>
      <div className="spec-diff-viewer__lines" data-testid="spec-diff-lines">
        {files.map((file, fi) =>
          file.hunks.map((hunk, hi) =>
            hunk.lines.map((line, li) => {
              const rowClass =
                line.type === 'add'
                  ? 'edit-diff-card__row--add'
                  : line.type === 'del'
                    ? 'edit-diff-card__row--del'
                    : 'edit-diff-card__row--ctx'
              return (
                <div key={`${fi}-${hi}-${li}`} className={`edit-diff-card__row ${rowClass}`}>
                  <span className="edit-diff-card__content">{line.content}</span>
                </div>
              )
            })
          )
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `SpecDiffViewer.css`**

Create `src/renderer/src/components/planner/SpecDiffViewer.css`:

```css
.spec-diff-viewer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.spec-diff-viewer__toggle {
  background: none;
  border: none;
  padding: 0;
  font-size: var(--fleet-size-xs, 11px);
  color: var(--fleet-text-muted, rgba(255, 255, 255, 0.55));
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  text-decoration: underline;
}

.spec-diff-viewer__toggle:hover {
  color: var(--fleet-text, rgba(255, 255, 255, 0.85));
}

.spec-diff-viewer__lines {
  max-height: 280px;
  overflow-y: auto;
  font-size: var(--fleet-size-xs, 11px);
  border-radius: 4px;
  overflow-x: hidden;
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
npm test -- --run src/renderer/src/components/planner/SpecDiffViewer.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/planner/SpecDiffViewer.tsx \
        src/renderer/src/components/planner/SpecDiffViewer.css \
        src/renderer/src/components/planner/SpecDiffViewer.test.tsx
git commit -m "feat(planner): add SpecDiffViewer component for update-spec action cards"
```

---

### Task 3: Wire SpecDiffViewer + Apply All into PlannerAssistant

**Files:**
- Modify: `src/renderer/src/components/planner/PlannerAssistant.tsx`
- Modify: `src/renderer/src/components/planner/__tests__/PlannerAssistant.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/renderer/src/components/planner/__tests__/PlannerAssistant.test.tsx`, add to the existing test file. First check how the file currently sets up mocks (it uses `vi.mock` for several things and `beforeEach` to set up `window.api`). Append these tests inside the main `describe` block:

```typescript
  describe('update-spec action cards', () => {
    it('renders SpecDiffViewer inside an update-spec action card', async () => {
      // Mock the streaming to return a message with an update-spec action
      vi.mocked(window.api.workbench.onChatChunk).mockImplementation((cb) => {
        // Simulate a chunk that contains an update-spec action
        setTimeout(() => {
          cb(`Here is the proposed update:\n[ACTION:update-spec]{"taskId":"task-123","spec":"## New Spec\nUpdated content"}[/ACTION]`)
        }, 0)
        return () => {}
      })
      vi.mocked(window.api.workbench.chatStream).mockResolvedValue(undefined)
      vi.mocked(window.api.sprint.update).mockResolvedValue({} as SprintTask)

      const mockTask = { id: 'task-123', title: 'My Task', spec: '## Old Spec\nOld content', status: 'backlog' } as SprintTask

      render(
        <PlannerAssistant
          open
          onClose={vi.fn()}
          epic={{ id: 'e1', name: 'Epic', goal: null, status: 'draft', icon: '📋', accent_color: '#4a9eff', depends_on: null, created_at: '', updated_at: '' }}
          tasks={[mockTask]}
          onOpenWorkbench={vi.fn()}
        />
      )

      // Send a message to trigger the streaming
      await userEvent.type(screen.getByPlaceholderText(/ask the assistant/i), 'update specs')
      await userEvent.keyboard('{Enter}')

      // Wait for the action card to appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show changes/i })).toBeInTheDocument()
      })
    })

    it('renders Apply All button when 2+ pending update-spec actions exist', async () => {
      vi.mocked(window.api.workbench.onChatChunk).mockImplementation((cb) => {
        setTimeout(() => {
          cb(`Updates:\n[ACTION:update-spec]{"taskId":"t1","spec":"spec1"}[/ACTION]\n[ACTION:update-spec]{"taskId":"t2","spec":"spec2"}[/ACTION]`)
        }, 0)
        return () => {}
      })
      vi.mocked(window.api.workbench.chatStream).mockResolvedValue(undefined)
      vi.mocked(window.api.sprint.update).mockResolvedValue({} as SprintTask)

      const tasks = [
        { id: 't1', title: 'Task 1', spec: 'old spec 1', status: 'backlog' } as SprintTask,
        { id: 't2', title: 'Task 2', spec: 'old spec 2', status: 'backlog' } as SprintTask,
      ]

      render(
        <PlannerAssistant
          open
          onClose={vi.fn()}
          epic={{ id: 'e1', name: 'Epic', goal: null, status: 'draft', icon: '📋', accent_color: '#4a9eff', depends_on: null, created_at: '', updated_at: '' }}
          tasks={tasks}
          onOpenWorkbench={vi.fn()}
        />
      )

      await userEvent.type(screen.getByPlaceholderText(/ask the assistant/i), 'update all')
      await userEvent.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /apply all/i })).toBeInTheDocument()
      })
    })
  })
```

Add `import { waitFor } from '@testing-library/react'` to imports if not already present. Also add `import type { SprintTask } from '../../../../../shared/types'`.

- [ ] **Step 2: Run to confirm tests fail**

```bash
npm test -- --run src/renderer/src/components/planner/__tests__/PlannerAssistant.test.tsx
```

Expected: new tests fail — no SpecDiffViewer or Apply All button.

- [ ] **Step 3: Update `ActionCardProps` and wire `oldSpec` in `PlannerAssistant.tsx`**

In `src/renderer/src/components/planner/PlannerAssistant.tsx`:

**a) Import SpecDiffViewer** at the top:
```typescript
import { SpecDiffViewer } from './SpecDiffViewer'
```

**b) Add `oldSpec` to `ActionCardProps`** (around line 88, after `firstRepo`):
```typescript
  oldSpec: string | null
```

**c) Add `oldSpec` to `ActionCard` destructure** (around line 111):
```typescript
  oldSpec
```

**d) In the `ActionCard` return**, after the `<div className="planner-assistant__action-card-title">` and before `{state.confirmed ? ...}`, add for `update-spec` actions:
```typescript
      {action.type === 'update-spec' && !state.confirmed && (
        <SpecDiffViewer oldSpec={oldSpec} newSpec={action.payload.spec ?? ''} />
      )}
```

**e) In `PlannerAssistantInner`**, in the `{msg.actions?.map((action, i) => (` block, compute `oldSpec` and pass it:

Replace the existing `<ActionCard ... />` JSX call with:
```typescript
              <ActionCard
                key={`${msg.id}-${i}`}
                messageId={msg.id}
                index={i}
                action={action}
                epicId={epic.id}
                cardStates={cardStates}
                onCardStateChange={(k, s) => setCardStates((prev) => ({ ...prev, [k]: s }))}
                onOpenWorkbench={onOpenWorkbench}
                onClose={onClose}
                epic={epic}
                firstRepo={firstRepo}
                oldSpec={
                  action.type === 'update-spec' && action.payload.taskId
                    ? (tasks.find(t => t.id === action.payload.taskId)?.spec ?? null)
                    : null
                }
              />
```

- [ ] **Step 4: Add "Apply All" button**

In `PlannerAssistantInner`, after the `{msg.actions?.map(...)}` block for each message, add the "Apply All" logic. Find the closing of the `msg.actions?.map` call and insert after it (still inside the `{messages.map((msg) => (` block):

```typescript
            {(() => {
              const pendingSpecActions = (msg.actions ?? [])
                .map((action, i) => ({ action, key: `${msg.id}-${i}` }))
                .filter(({ action: a, key }) =>
                  a.type === 'update-spec' &&
                  !(cardStates[key]?.confirmed) &&
                  !(cardStates[key]?.dismissed)
                )

              if (pendingSpecActions.length < 2) return null

              const handleApplyAll = async (): Promise<void> => {
                for (const { action: a, key } of pendingSpecActions) {
                  if (!a.payload.taskId) continue
                  try {
                    await window.api.sprint.update(a.payload.taskId, { spec: a.payload.spec ?? '' })
                    setCardStates(prev => ({ ...prev, [key]: { dismissed: false, confirmed: '✓ Done' } }))
                  } catch {
                    setCardStates(prev => ({ ...prev, [key]: { dismissed: false, confirmed: '✗ Failed' } }))
                  }
                }
              }

              return (
                <div className="planner-assistant__apply-all-bar">
                  <button
                    type="button"
                    className="planner-assistant__action-btn planner-assistant__action-btn--primary"
                    onClick={() => void handleApplyAll()}
                  >
                    Apply All ({pendingSpecActions.length})
                  </button>
                </div>
              )
            })()}
```

Add the CSS for the apply-all bar in `src/renderer/src/components/planner/PlannerAssistant.css`:
```css
.planner-assistant__apply-all-bar {
  display: flex;
  justify-content: flex-end;
  padding: 4px 0 0;
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
npm test -- --run src/renderer/src/components/planner/__tests__/PlannerAssistant.test.tsx
npm run typecheck
```

Expected: all tests pass, zero type errors.

- [ ] **Step 6: Run full suite**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/planner/PlannerAssistant.tsx \
        src/renderer/src/components/planner/PlannerAssistant.css \
        src/renderer/src/components/planner/__tests__/PlannerAssistant.test.tsx
git commit -m "feat(planner): show spec diff on update-spec cards and add Apply All button"
```

---

## Self-Review

**Spec coverage:**
- ✅ `buildSyntheticDiff` extracted to shared util (Task 1)
- ✅ `EditDiffCard` updated to use shared util (Task 1)
- ✅ `SpecDiffViewer` collapsed by default with Show/Hide toggle (Task 2)
- ✅ `SpecDiffViewer` renders add/del lines with existing CSS classes (Task 2)
- ✅ null/empty `oldSpec` shows all-additions (Task 2)
- ✅ `oldSpec` looked up from `tasks` in `PlannerAssistantInner` (Task 3)
- ✅ `SpecDiffViewer` rendered inside `update-spec` cards (Task 3)
- ✅ "Apply All" button appears when 2+ pending update-spec actions (Task 3)
- ✅ "Apply All" applies each in sequence (Task 3)

**Type consistency:** `oldSpec: string | null` used consistently in `ActionCardProps`, ActionCard function signature, and the lookup expression. `SpecDiffViewer` props match exactly. `buildSyntheticDiff` signature identical in `spec-diff.ts` and how it was previously defined in `EditDiffCard.tsx`.
