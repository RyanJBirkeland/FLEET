# SankeyPipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dashboard's simple PipelineFlow with an animated SVG Sankey flow diagram showing task state topology with particle flow, transition animations, and clickable stage nodes.

**Architecture:** New `SankeyPipeline` React component renders an SVG with 6 stage nodes (4 happy path + 2 problem states), bezier flow paths, ambient particles via SVG `<animateMotion>`, and JS-driven transition burst/ripple effects triggered by count changes. Uses existing neon design system (`neonVar`, `NeonAccent`). Integrates into DashboardView by replacing PipelineFlow and using `partitionSprintTasks()` for accurate, non-overlapping counts.

**Tech Stack:** React, SVG, CSS keyframe animations, `requestAnimationFrame` for burst particles, `useReducedMotion` from framer-motion, vitest + @testing-library/react for tests.

**Spec:** `docs/superpowers/specs/2026-04-01-sankey-pipeline-design.md`

---

## File Structure

| File                                                                 | Action | Responsibility                                                                                    |
| -------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `src/renderer/src/components/neon/SankeyPipeline.tsx`                | Create | Main component: SVG layout, nodes, paths, particles, transitions, interaction                     |
| `src/renderer/src/components/neon/sankey-utils.ts`                   | Create | Pure helpers: `formatCount()`, `STAGE_CONFIG`, `STAGE_TO_FILTER` mapping, node position constants |
| `src/renderer/src/assets/sankey-pipeline-neon.css`                   | Create | Keyframes (ripple, pulse, count-flash), hover/focus styles, reduced motion                        |
| `src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx` | Create | Unit tests                                                                                        |
| `src/renderer/src/components/neon/index.ts`                          | Modify | Add SankeyPipeline export                                                                         |
| `src/renderer/src/views/DashboardView.tsx`                           | Modify | Swap PipelineFlow → SankeyPipeline, use partitionSprintTasks()                                    |

---

### Task 1: Sankey Utilities

**Files:**

- Create: `src/renderer/src/components/neon/sankey-utils.ts`
- Test: `src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`

- [ ] **Step 1: Write tests for utility functions**

```typescript
// src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx
import { describe, it, expect } from 'vitest'
import { formatCount, STAGE_CONFIG, STAGE_TO_FILTER } from '../sankey-utils'

describe('sankey-utils', () => {
  describe('formatCount', () => {
    it('returns number as string for counts under 1000', () => {
      expect(formatCount(0)).toBe('0')
      expect(formatCount(42)).toBe('42')
      expect(formatCount(999)).toBe('999')
    })

    it('abbreviates counts of 1000+', () => {
      expect(formatCount(1000)).toBe('1.0k')
      expect(formatCount(1234)).toBe('1.2k')
      expect(formatCount(9999)).toBe('10.0k')
    })
  })

  describe('STAGE_CONFIG', () => {
    it('has entries for all 6 stages', () => {
      expect(Object.keys(STAGE_CONFIG)).toEqual(
        expect.arrayContaining(['queued', 'active', 'review', 'done', 'blocked', 'failed'])
      )
      expect(Object.keys(STAGE_CONFIG)).toHaveLength(6)
    })

    it('each stage has accent and label', () => {
      for (const config of Object.values(STAGE_CONFIG)) {
        expect(config).toHaveProperty('accent')
        expect(config).toHaveProperty('label')
      }
    })
  })

  describe('STAGE_TO_FILTER', () => {
    it('maps stage keys to StatusFilter values', () => {
      expect(STAGE_TO_FILTER.queued).toBe('todo')
      expect(STAGE_TO_FILTER.active).toBe('in-progress')
      expect(STAGE_TO_FILTER.review).toBe('awaiting-review')
      expect(STAGE_TO_FILTER.done).toBe('done')
      expect(STAGE_TO_FILTER.blocked).toBe('blocked')
      expect(STAGE_TO_FILTER.failed).toBe('failed')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement sankey-utils.ts**

```typescript
// src/renderer/src/components/neon/sankey-utils.ts
import type { NeonAccent } from './types'
import type { StatusFilter } from '../../stores/sprintUI'

/** Format count for display. Abbreviates 1000+ as "1.2k". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(1)}k`
}

export type SankeyStageKey = 'queued' | 'active' | 'review' | 'done' | 'blocked' | 'failed'

export interface StageConfig {
  accent: NeonAccent
  label: string
  /** Whether this is a "problem" stage (rendered smaller, below happy path) */
  problem: boolean
}

export const STAGE_CONFIG: Record<SankeyStageKey, StageConfig> = {
  queued: { accent: 'orange', label: 'QUEUED', problem: false },
  active: { accent: 'cyan', label: 'ACTIVE', problem: false },
  review: { accent: 'purple', label: 'REVIEW', problem: false },
  done: { accent: 'blue', label: 'DONE', problem: false },
  blocked: { accent: 'red', label: 'BLOCKED', problem: true },
  failed: { accent: 'red', label: 'FAILED', problem: true }
}

export const STAGE_TO_FILTER: Record<SankeyStageKey, StatusFilter> = {
  queued: 'todo',
  active: 'in-progress',
  review: 'awaiting-review',
  done: 'done',
  blocked: 'blocked',
  failed: 'failed'
}

/** Happy path stage keys in flow order. */
export const HAPPY_PATH: SankeyStageKey[] = ['queued', 'active', 'review', 'done']
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/neon/sankey-utils.ts src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx
git commit -m "feat: add SankeyPipeline utility functions and config"
```

---

### Task 2: CSS Keyframes & Styles

**Files:**

- Create: `src/renderer/src/assets/sankey-pipeline-neon.css`

- [ ] **Step 1: Create the CSS file with keyframes, hover/focus, and reduced motion**

```css
/* src/renderer/src/assets/sankey-pipeline-neon.css */
/* ═══════════════════════════════════════════════════════
   Sankey Pipeline — Keyframes, Hover, Focus, Reduced Motion
   ═══════════════════════════════════════════════════════ */

/* ── Ripple effect on destination node ── */
@keyframes sankey-ripple {
  from {
    transform: scale(1);
    opacity: 0.4;
  }
  to {
    transform: scale(1.3);
    opacity: 0;
  }
}

/* ── Count number flash on change ── */
@keyframes sankey-count-flash {
  0% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}

/* ── Active node pulse ring ── */
@keyframes sankey-pulse {
  0%,
  100% {
    stroke-opacity: 0.15;
  }
  50% {
    stroke-opacity: 0.4;
  }
}

/* ── SVG transform origin fix for Electron/Chromium ── */
.sankey-ripple,
.sankey-count-flash {
  transform-box: fill-box;
  transform-origin: center;
}

.sankey-pulse-ring {
  animation: sankey-pulse 2.5s ease-in-out infinite;
}

/* ── Node interactivity ── */
.sankey-node {
  cursor: pointer;
  outline: none;
}

.sankey-node:hover .sankey-node__bg {
  filter: brightness(1.3);
}

.sankey-node:focus-visible .sankey-node__focus-ring {
  stroke-opacity: 0.6;
}

.sankey-node__focus-ring {
  stroke-opacity: 0;
  transition: stroke-opacity 150ms ease;
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .sankey-particle {
    display: none;
  }
  .sankey-pulse-ring {
    animation: none;
  }
  .sankey-ripple {
    animation: none;
  }
  .sankey-count-flash {
    animation: none;
  }
}
```

- [ ] **Step 2: Verify CSS file imports will work — check main.css import order**

Run: `grep -n 'sankey\|pipeline-neon\|neon.css' src/renderer/src/assets/main.css` (or wherever CSS is imported)

If CSS is imported directly in the component file (like `dashboard-neon.css` is), that's fine too — import it in `SankeyPipeline.tsx` in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/assets/sankey-pipeline-neon.css
git commit -m "feat: add SankeyPipeline CSS keyframes and interaction styles"
```

---

### Task 3: Static SVG Component (Nodes + Paths)

**Files:**

- Create: `src/renderer/src/components/neon/SankeyPipeline.tsx`
- Modify: `src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`

- [ ] **Step 1: Add rendering tests for the static SVG**

Append to the existing test file:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { SankeyPipeline } from '../SankeyPipeline'
import type { StatusFilter } from '../../../stores/sprintUI'

const defaultStages = {
  queued: 5, active: 3, review: 2, done: 12, blocked: 1, failed: 2,
}

describe('SankeyPipeline', () => {
  it('renders all 6 stage nodes', () => {
    const { container } = render(<SankeyPipeline stages={defaultStages} />)
    const nodes = container.querySelectorAll('[data-role="sankey-node"]')
    expect(nodes).toHaveLength(6)
  })

  it('displays correct counts for each stage', () => {
    render(<SankeyPipeline stages={defaultStages} />)
    expect(screen.getByText('5')).toBeInTheDocument()   // queued
    expect(screen.getByText('3')).toBeInTheDocument()   // active
    expect(screen.getByText('2')).toBeInTheDocument()   // review (and failed)
    expect(screen.getByText('12')).toBeInTheDocument()  // done
    expect(screen.getByText('1')).toBeInTheDocument()   // blocked
  })

  it('displays stage labels', () => {
    render(<SankeyPipeline stages={defaultStages} />)
    expect(screen.getByText('QUEUED')).toBeInTheDocument()
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('REVIEW')).toBeInTheDocument()
    expect(screen.getByText('DONE')).toBeInTheDocument()
    expect(screen.getByText('BLOCKED')).toBeInTheDocument()
    expect(screen.getByText('FAILED')).toBeInTheDocument()
  })

  it('renders flow paths', () => {
    const { container } = render(<SankeyPipeline stages={defaultStages} />)
    const mainPaths = container.querySelectorAll('[data-role="sankey-flow-main"]')
    const branchPaths = container.querySelectorAll('[data-role="sankey-flow-branch"]')
    expect(mainPaths.length).toBe(3)     // queued→active, active→review, review→done
    expect(branchPaths.length).toBe(3)   // active→blocked, active→failed, review→failed
  })

  it('calls onStageClick with correct StatusFilter', () => {
    const onClick = vi.fn()
    render(<SankeyPipeline stages={defaultStages} onStageClick={onClick} />)
    // Click the "QUEUED" label's parent node
    const queuedNode = screen.getByText('QUEUED').closest('[data-role="sankey-node"]')!
    fireEvent.click(queuedNode)
    expect(onClick).toHaveBeenCalledWith('todo')
  })

  it('handles keyboard activation on nodes', () => {
    const onClick = vi.fn()
    render(<SankeyPipeline stages={defaultStages} onStageClick={onClick} />)
    const activeNode = screen.getByText('ACTIVE').closest('[data-role="sankey-node"]')!
    fireEvent.keyDown(activeNode, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledWith('in-progress')
  })

  it('applies custom className', () => {
    const { container } = render(
      <SankeyPipeline stages={defaultStages} className="my-custom" />
    )
    expect(container.firstChild).toHaveClass('my-custom')
  })

  it('formats large counts with abbreviation', () => {
    render(<SankeyPipeline stages={{ ...defaultStages, done: 1234 }} />)
    expect(screen.getByText('1.2k')).toBeInTheDocument()
  })

  it('renders aria-labels on nodes', () => {
    const { container } = render(<SankeyPipeline stages={defaultStages} />)
    const activeNode = container.querySelector('[data-stage="active"]')
    expect(activeNode?.getAttribute('aria-label')).toContain('3 active')
  })

  it('renders all counts as zero without crashing', () => {
    const zeros = { queued: 0, active: 0, review: 0, done: 0, blocked: 0, failed: 0 }
    const { container } = render(<SankeyPipeline stages={zeros} />)
    const nodes = container.querySelectorAll('[data-role="sankey-node"]')
    expect(nodes).toHaveLength(6)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`
Expected: FAIL — SankeyPipeline not found

- [ ] **Step 3: Implement the static SVG component**

Create `src/renderer/src/components/neon/SankeyPipeline.tsx`. This is the largest implementation step. The component should:

1. Import `neonVar` from `./types`, `formatCount`, `STAGE_CONFIG`, `STAGE_TO_FILTER`, `HAPPY_PATH` from `./sankey-utils`, and `StatusFilter` from stores.
2. Import `'../../assets/sankey-pipeline-neon.css'`.
3. Define node positions as constants (x, y, width, height for each of the 6 stages) — happy path nodes at y~25, problem nodes at y~105.
4. Define bezier path data for each flow connection using template literal `d` attributes.
5. Render SVG with `viewBox="0 0 540 160"`:
   - `<defs>` with a glow `<filter>` (Gaussian blur + merge)
   - Layer 1: Flow paths (3 main + 2 branch), each a `<path>` with `data-role="sankey-flow-main"` or `data-role="sankey-flow-branch"`
   - Layer 2: 6 node `<g>` groups, each with `data-role="sankey-node"`, `data-stage={key}`, `role="button"`, `tabIndex={0}`, `aria-label`, `onClick`, `onKeyDown` (Enter/Space). Contains: background `<rect>` with class `sankey-node__bg`, count `<text>`, label `<text>`, focus ring `<rect>` with class `sankey-node__focus-ring`
   - Active node additionally gets a pulse ring `<rect>` with class `sankey-pulse-ring`
6. Handle click via internal mapping: `onStageClick?.(STAGE_TO_FILTER[stageKey])`
7. Handle keyboard: `if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStageClick?.(STAGE_TO_FILTER[stageKey]) }`

Node positions (approximate, tuned visually):

```
queued:  { x: 8,   y: 25, w: 82,  h: 65 }
active:  { x: 160, y: 22, w: 80,  h: 55 }
review:  { x: 310, y: 22, w: 85,  h: 55 }
done:    { x: 455, y: 18, w: 75,  h: 50 }
blocked: { x: 160, y: 105, w: 80, h: 40 }
failed:  { x: 355, y: 100, w: 75, h: 40 }
```

Use `neonVar(config.accent, 'surface')` for fill, `neonVar(config.accent, 'border')` for stroke, `neonVar(config.accent, 'color')` for text, `neonVar(config.accent, 'glow')` for filter/shadow.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/neon/SankeyPipeline.tsx src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx
git commit -m "feat: add SankeyPipeline static SVG with nodes, paths, and interaction"
```

---

### Task 4: Ambient Particles

**Files:**

- Modify: `src/renderer/src/components/neon/SankeyPipeline.tsx`
- Modify: `src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`

- [ ] **Step 1: Add particle tests**

```typescript
describe('SankeyPipeline particles', () => {
  it('renders ambient particles when animated', () => {
    const { container } = render(<SankeyPipeline stages={defaultStages} />)
    const particles = container.querySelectorAll('.sankey-particle')
    expect(particles.length).toBeGreaterThanOrEqual(2)
  })

  it('hides particles when animated=false', () => {
    const { container } = render(
      <SankeyPipeline stages={defaultStages} animated={false} />
    )
    const particles = container.querySelectorAll('.sankey-particle')
    expect(particles).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`
Expected: FAIL — no particles rendered yet

- [ ] **Step 3: Add ambient particles to the SVG**

In `SankeyPipeline.tsx`, after the node layer, add Layer 3: ambient particles. Only render when `animated && !reduced`:

- Construct a composite SVG path `d` string that traces the happy path through all 4 node centers (using bezier curves matching the flow paths).
- Render 2-3 `<circle>` elements with class `sankey-particle`, each containing:
  - `<animateMotion dur="Xs" repeatCount="indefinite" begin="Ys" path={happyPathD} />`
  - `<animate attributeName="fill" values="orange;cyan;purple;blue" dur="Xs" repeatCount="indefinite" begin="Ys" />`
  - `<animate attributeName="opacity" values="0;0.8;0.8;0.8;0" dur="Xs" repeatCount="indefinite" begin="Ys" />`
- Stagger begin times (0s, 2.5s, 5s) and vary durations (6s, 5.5s, 7s) and radii (3.5, 2.5, 2).

Check `useReducedMotion()` from `framer-motion` — if `reduced` is true OR `animated` prop is false, skip rendering particles entirely.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/neon/SankeyPipeline.tsx src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx
git commit -m "feat: add ambient particle flow to SankeyPipeline"
```

---

### Task 5: Transition Animations (Burst + Ripple)

**Files:**

- Modify: `src/renderer/src/components/neon/SankeyPipeline.tsx`
- Modify: `src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`

- [ ] **Step 1: Add transition detection tests**

```typescript
import { act } from '@testing-library/react'

describe('SankeyPipeline transitions', () => {
  it('detects count changes between renders', () => {
    const { container, rerender } = render(
      <SankeyPipeline stages={{ ...defaultStages, queued: 5 }} />
    )
    act(() => {
      rerender(
        <SankeyPipeline stages={{ ...defaultStages, queued: 4, active: 4 }} />
      )
    })
    // After count change, the updated counts should reflect
    expect(screen.getByText('4')).toBeInTheDocument() // both queued and active are now 4
  })

  it('adds ripple class to destination node on count increase', () => {
    const { container, rerender } = render(
      <SankeyPipeline stages={defaultStages} />
    )
    act(() => {
      rerender(
        <SankeyPipeline stages={{ ...defaultStages, active: 4 }} />
      )
    })
    const activeNode = container.querySelector('[data-stage="active"]')
    const ripple = activeNode?.querySelector('.sankey-ripple')
    expect(ripple).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`
Expected: FAIL — no ripple element

- [ ] **Step 3: Implement transition detection and effects**

In `SankeyPipeline.tsx`:

1. Add `useRef` to store previous stage counts.
2. Add `useState` for active transitions: `transitions: Array<{ from: SankeyStageKey, to: SankeyStageKey, startTime: number }>`.
3. In a `useEffect`, compare current `stages` with `prevRef.current`. For each stage where count increased, infer the source (the adjacent stage whose count decreased) and add a transition entry. Update `prevRef.current`.
4. **Ripple effect:** When a transition targets a node, render an additional `<rect>` with class `sankey-ripple` inside that node's `<g>`. Apply `animation: sankey-ripple 600ms ease-out forwards`. Remove after animation ends via `onAnimationEnd` or a timeout.
5. **Count flash:** Add class `sankey-count-flash` to the count `<text>` element when its value changes. Remove after 400ms.
6. **Burst particles:** Use a `requestAnimationFrame`-driven loop. On transition start, create 3-5 particle positions that interpolate along the bezier path from source to destination over 600ms. Store in state, render as `<circle>` elements with the source accent color and glow filter. Clean up after 600ms.
7. Skip all effects when `reduced` motion is active — just update counts instantly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/neon/SankeyPipeline.tsx src/renderer/src/components/neon/__tests__/SankeyPipeline.test.tsx
git commit -m "feat: add transition burst and ripple animations to SankeyPipeline"
```

---

### Task 6: Export & Dashboard Integration

**Files:**

- Modify: `src/renderer/src/components/neon/index.ts`
- Modify: `src/renderer/src/views/DashboardView.tsx`

- [ ] **Step 1: Add SankeyPipeline export to barrel file**

In `src/renderer/src/components/neon/index.ts`, add:

```typescript
export { SankeyPipeline } from './SankeyPipeline'
```

Also export the props type if needed:

```typescript
export type { SankeyStageKey } from './sankey-utils'
```

- [ ] **Step 2: Update DashboardView.tsx**

Changes to `src/renderer/src/views/DashboardView.tsx`:

1. Replace `PipelineFlow` import with `SankeyPipeline`:

   ```typescript
   // Remove PipelineFlow and PipelineStage from imports
   // Add:
   import { SankeyPipeline } from '../components/neon'
   ```

2. Add `partitionSprintTasks` import:

   ```typescript
   import { partitionSprintTasks } from '../lib/partitionSprintTasks'
   ```

3. Add a `partitions` memo (after the existing `stats` memo):

   ```typescript
   const partitions = useMemo(() => partitionSprintTasks(tasks), [tasks])
   ```

4. Remove the `pipelineStages` memo (lines ~115-123) — no longer needed.

5. Replace the Pipeline NeonCard contents (around line ~201-203):

   ```tsx
   <NeonCard accent="purple" title="Pipeline" icon={<Activity size={12} />}>
     <SankeyPipeline
       stages={{
         queued: partitions.todo.length,
         active: partitions.inProgress.length,
         review: partitions.awaitingReview.length,
         done: partitions.done.length,
         blocked: partitions.blocked.length,
         failed: partitions.failed.length
       }}
       onStageClick={navigateToSprintWithFilter}
     />
   </NeonCard>
   ```

6. Remove unused `PipelineStage` type import and `type PipelineStage` from the neon import.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: PASS (existing DashboardView tests should still pass — the card renders differently but surrounding tests shouldn't break)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/neon/index.ts src/renderer/src/views/DashboardView.tsx
git commit -m "feat: integrate SankeyPipeline into Dashboard, replace PipelineFlow"
```

---

### Task 7: Visual QA & Polish

**Files:**

- Possibly: `src/renderer/src/components/neon/SankeyPipeline.tsx` (tuning)
- Possibly: `src/renderer/src/assets/sankey-pipeline-neon.css` (tuning)

- [ ] **Step 1: Run the app and visually verify**

Run: `npm run dev`

Check:

- Dashboard loads without errors
- All 6 nodes render with correct counts and colors
- Flow paths are visible behind nodes
- Ambient particles flow along happy path
- Clicking nodes navigates to Sprint with correct filter
- Hover shows glow intensify + pointer cursor
- Keyboard Tab cycles through nodes, Enter activates

- [ ] **Step 2: Test transition animations**

In the running app, trigger a task status change (create a test task, move it through statuses) and verify:

- Particle burst shoots from source to destination
- Ripple ring expands and fades on destination node
- Count numbers animate

- [ ] **Step 3: Test edge cases**

Verify with:

- Zero tasks (fresh state) — all nodes show 0, particles still flow
- Many tasks (if possible) — counts display correctly
- Resizing the window — SVG scales via viewBox

- [ ] **Step 4: Test reduced motion**

In System Preferences → Accessibility → Display → Reduce Motion (or via Chrome DevTools emulation), verify:

- No particles, no pulse, no ripple
- Static nodes and paths still visible
- Counts update instantly

- [ ] **Step 5: Final commit if any polish was needed**

```bash
git add -A
git commit -m "fix: polish SankeyPipeline visual tuning"
```

- [ ] **Step 6: Run full CI checks**

```bash
npm run lint && npm run typecheck && npm run test:coverage
```

Expected: All pass. Coverage should not decrease (new tests added).
