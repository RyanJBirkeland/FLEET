# Sankey Pipeline Component — Design Spec

**Date:** 2026-04-01
**Status:** Approved
**Scope:** Replace Dashboard's PipelineFlow with an animated SVG Sankey flow diagram

## Overview

Replace the simple `PipelineFlow` component on the Dashboard with a new `SankeyPipeline` component — an SVG-based Sankey flow diagram showing the task state machine with animated particles and transition effects.

## Topology

**Happy path (top row):** Queued → Active → Review → Done
**Problem states (below, visually demoted):** Blocked (beneath Active), Failed (beneath Review/Done)

```
  ┌────────┐    ┌────────┐    ┌────────┐    ┌──────┐
  │ QUEUED │───▶│ ACTIVE │───▶│ REVIEW │───▶│ DONE │
  │   5    │    │   3    │    │   2    │    │  12  │
  └────────┘    └───┬────┘    └───┬────┘    └──────┘
                    │             │
                    ▼             ▼
               ┌─────────┐  ┌────────┐
               │ BLOCKED  │  │ FAILED │
               │    1     │  │   2    │
               └──────────┘  └────────┘
```

Flow paths are thick translucent bezier curves drawn behind nodes. Problem branch paths are thinner and more muted.

## Visual Design

### Nodes

- **Happy path nodes:** Rounded rects (~80-90px wide, ~58-65px tall), semi-transparent accent-colored fill, accent-colored border (1.5px), large count number with neon glow filter, uppercase label below count
- **Problem nodes:** Smaller (~75px wide, ~40px tall), positioned below happy path, more muted opacity, dashed or dim borders
- **Active node:** Gets a subtle animated pulse ring (expanding/contracting stroke-opacity on an outer rect)

### Color mapping

| Stage   | Accent Color | Neon Var                 |
| ------- | ------------ | ------------------------ |
| Queued  | orange       | `neonVar('orange', ...)` |
| Active  | cyan         | `neonVar('cyan', ...)`   |
| Review  | purple       | `neonVar('purple', ...)` |
| Done    | blue         | `neonVar('blue', ...)`   |
| Blocked | red          | `neonVar('red', ...)`    |
| Failed  | red          | `neonVar('red', ...)`    |

### Flow Paths

- Thick translucent bezier curves (`stroke-width` ~14-20px for main flow, ~4-6px for problem branches)
- Drawn behind nodes (rendered first in SVG)
- `stroke-linecap="round"` for soft endpoints
- Main flow paths use the destination stage's accent color at low opacity (~0.12)
- Problem branch paths use red at very low opacity (~0.06-0.08)

### Ambient Particles

2-3 SVG circles continuously flowing along the happy path using `<animateMotion>` with a path matching the bezier route through all four happy-path nodes. Particles:

- Shift color as they traverse (orange → cyan → purple → blue) via `<animate attributeName="fill">`
- Vary in size (r=2.5 to r=3.5) and opacity (0.5 to 0.9)
- Staggered start times so they don't cluster
- Duration ~5-7s per full traversal

## Transition Animations

Triggered when stage counts change between renders (detected by comparing previous counts via `useRef`).

### Sequence (~800ms total)

1. **Particle burst (0-600ms):** 3-5 particles shoot from source node center to destination node center along the bezier path. Particles are small circles with glow filter, fading in at source and fading out at destination.

2. **Ripple effect (200-800ms):** Destination node emits an expanding ring (SVG circle or rect matching node shape) that scales up from 1x to 1.3x while opacity fades from 0.4 to 0. Uses the destination's accent color.

3. **Count animation (0-400ms):** Source count decrements and destination count increments. The changing number does a brief scale-up (1x → 1.15x → 1x) with a text-shadow flash.

### Implementation

- Use `useRef` to store previous counts
- On count change, set a transition state with `{ from, to, startTime }`
- Use `requestAnimationFrame` loop for the burst particles (SVG `<animate>` won't work for dynamic one-shot animations)
- Ripple and count flash can use CSS keyframe animations triggered by adding/removing a class
- Multiple simultaneous transitions are supported (e.g., a task moves from queued→active while another moves from active→review)

## Interaction

- **Click:** Each stage node is clickable, calling `onStageClick(stage)` which navigates to Sprint view with the corresponding status filter
- **Hover:** Border glow intensifies (increase border opacity and box-shadow spread), `cursor: pointer`
- **Focus:** Visible focus ring using accent color for keyboard navigation
- **Keyboard:** `tabIndex={0}` on each node group, `role="button"`, `aria-label` (e.g., "3 active tasks — click to view"), Enter/Space triggers click
- **Problem nodes:** Also clickable (Blocked → 'blocked' filter, Failed → 'failed' filter, though this maps to the failed partition)

## Reduced Motion

When `prefers-reduced-motion` is active (detected via `useReducedMotion()` from framer-motion):

- No ambient particles
- No pulse ring on Active node
- No particle burst or ripple on transitions
- Count changes are instant (no scale animation)
- Flow paths and nodes still render normally (static)

## Props Interface

```typescript
interface SankeyPipelineProps {
  stages: {
    queued: number
    active: number
    review: number
    done: number
    blocked: number
    failed: number
  }
  onStageClick?: (filter: StatusFilter) => void
  animated?: boolean
  className?: string
}
```

- `stages`: Count for each stage. Component derives all visuals from these numbers.
- `onStageClick`: Called with the mapped `StatusFilter` value (not the stage key) when a node is clicked. The component owns the stage-key → StatusFilter mapping internally. The Dashboard wires this directly to `navigateToSprintWithFilter`.
- `animated`: Override for animation (defaults to `true`, but component also checks `useReducedMotion`)
- `className`: Additional CSS class for the wrapper

## SVG Structure

```
<svg viewBox="0 0 540 160">
  <defs>
    <!-- Glow filters -->
    <!-- Ripple keyframe animations (CSS in external stylesheet) -->
  </defs>

  <!-- Layer 1: Flow paths (behind everything) -->
  <path class="sankey-flow sankey-flow--main" ... />   <!-- Queued → Active -->
  <path class="sankey-flow sankey-flow--main" ... />   <!-- Active → Review -->
  <path class="sankey-flow sankey-flow--main" ... />   <!-- Review → Done -->
  <path class="sankey-flow sankey-flow--branch" ... /> <!-- Active → Blocked -->
  <path class="sankey-flow sankey-flow--branch" ... /> <!-- Active → Failed -->
  <path class="sankey-flow sankey-flow--branch" ... /> <!-- Review → Failed -->

  <!-- Layer 2: Nodes -->
  <g class="sankey-node sankey-node--queued" role="button" tabindex="0">
    <rect ... />           <!-- Node background -->
    <rect ... />           <!-- Pulse ring (Active only) -->
    <text ... />           <!-- Count -->
    <text ... />           <!-- Label -->
  </g>
  <!-- ... repeat for each stage -->

  <!-- Layer 3: Ambient particles -->
  <circle class="sankey-particle">
    <animateMotion ... />
    <animate attributeName="fill" ... />
  </circle>
  <!-- 2-3 particles with staggered timing -->

  <!-- Layer 4: Transition effects (dynamically added/removed) -->
  <!-- Burst particles: positioned via JS during transitions -->
  <!-- Ripple rings: CSS-animated, added on count change -->
</svg>
```

## CSS (sankey-pipeline-neon.css)

```css
/* Ripple animation */
/* Note: SVG transform animations require transform-box: fill-box
   and explicit transform-origin for correct scale origin in Electron/Chromium */
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

/* Count flash */
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

/* SVG transform origin fix */
.sankey-ripple,
.sankey-count-flash {
  transform-box: fill-box;
  transform-origin: center;
}

/* Pulse ring on Active node */
@keyframes sankey-pulse {
  0%,
  100% {
    stroke-opacity: 0.15;
  }
  50% {
    stroke-opacity: 0.4;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .sankey-particle {
    display: none;
  }
  .sankey-node--active .sankey-pulse-ring {
    animation: none;
  }
}
```

## Integration with DashboardView

### Changes to DashboardView.tsx

1. Import `SankeyPipeline` instead of `PipelineFlow`
2. Use `partitionSprintTasks()` from `src/renderer/src/lib/partitionSprintTasks.ts` to derive all stage counts. This avoids double-counting (e.g., a task with `status=active, pr_status=open` must appear in Review, not Active). The partition function already handles `awaitingReview` (checking `pr_status === 'open' || pr_status === 'branch_only'`).
3. Replace the Pipeline NeonCard contents:

```tsx
const partitions = useMemo(() => partitionSprintTasks(tasks), [tasks])

// ...

<NeonCard accent="purple" title="Pipeline" icon={<Activity size={12} />}>
  <SankeyPipeline
    stages={{
      queued: partitions.todo.length,
      active: partitions.inProgress.length,
      review: partitions.awaitingReview.length,
      done: partitions.done.length,
      blocked: partitions.blocked.length,
      failed: partitions.failed.length,
    }}
    onStageClick={(stage) => navigateToSprintWithFilter(stage)}
  />
</NeonCard>
```

Note: `backlog` tasks are intentionally excluded from the pipeline — they haven't entered the execution flow yet.

### StatusFilter Mapping

The component internally maps stage keys to `StatusFilter` values before calling `onStageClick`:

| Pipeline Stage | StatusFilter Value  |
| -------------- | ------------------- |
| queued         | `'todo'`            |
| active         | `'in-progress'`     |
| review         | `'awaiting-review'` |
| done           | `'done'`            |
| blocked        | `'blocked'`         |
| failed         | `'failed'`          |

## Files

| File                                                  | Action | Description                                                    |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------- |
| `src/renderer/src/components/neon/SankeyPipeline.tsx` | Create | New component (~250-350 LOC)                                   |
| `src/renderer/src/assets/sankey-pipeline-neon.css`    | Create | Keyframes + reduced motion rules                               |
| `src/renderer/src/components/neon/index.ts`           | Modify | Export SankeyPipeline                                          |
| `src/renderer/src/views/DashboardView.tsx`            | Modify | Swap PipelineFlow for SankeyPipeline, add review/failed counts |

## Edge Cases

- **All-zero state:** All nodes render with "0" counts. Ambient particles still flow (gives life to the pipeline even when idle). No special empty-state treatment — the Dashboard's own empty state handling covers the zero-task scenario.
- **Large counts (100+):** Counts display as-is up to 999. At 1000+, abbreviate to "1.2k" format to prevent text overflow in the ~80px node width.
- **Backlog tasks:** Intentionally excluded from the pipeline. Backlog tasks haven't entered the execution flow yet.

## Not in Scope

- Proportional path thickness based on task volume (v2 enhancement)
- Drag-and-drop task movement between stages
- Tooltip on hover showing task titles per stage
- Removing the old PipelineFlow component (still used elsewhere potentially)
