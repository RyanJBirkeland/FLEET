# Console body file restructure (no visual change)

## Problem

`src/renderer/src/components/agents/ConsoleLine.tsx` is a 374-line file with a giant `switch (block.type)` statement rendering every event type. Subsequent tasks (05, 06) need to apply card-grammar styling per type, which would create merge conflicts if both tried to edit the same monolithic file. This task splits the file into a `cards/` directory of small per-type components, with **zero visual change** — each card initially produces the exact same JSX as today.

## Solution

Create a new directory `src/renderer/src/components/agents/cards/` and split `ConsoleLine.tsx` into:

```
cards/
  ConsoleCard.tsx          ← entry point with switch (block.type) router
  StartedCard.tsx
  TextCard.tsx             ← agent text type
  UserMessageCard.tsx
  ThinkingCard.tsx         ← reasoning
  ToolCallCard.tsx         ← single tool call (block.type === 'tool_call')
  ToolPairCard.tsx         ← tool with result (block.type === 'tool_pair')
  ToolGroupCard.tsx
  StderrCard.tsx
  ErrorCard.tsx
  RateLimitedCard.tsx
  CompletionCard.tsx       ← extracted from ConsoleLine.tsx:254-301
  PlaygroundCard.tsx       ← extracted from ConsoleLine.tsx:351-372
  util.ts                  ← formatTime, formatTokenCount, getToolMeta, TOOL_MAP
```

`ConsoleCard.tsx` exports the router component that switches on `block.type` and dispatches to the right card. Each card file imports `util.ts` for shared helpers.

`AgentConsole.tsx` updates its import: `import { ConsoleLine } from './ConsoleLine'` → `import { ConsoleCard } from './cards/ConsoleCard'` and uses `<ConsoleCard ... />` in the virtualized list.

`ConsoleLine.tsx` is **deleted** after migration.
`ConsoleLine.css` is **renamed** to `cards/ConsoleCard.css` and imported by each card file (or kept centralized — implementer's choice). All classes referenced today must continue to exist with the same names.

**This is a pure refactor.** Each card must render the EXACT same JSX as today's `ConsoleLine.tsx` switch case. No styling changes, no new icons, no card chrome, no new layouts. Tasks 05 and 06 will apply visual changes.

## Files to Change

- DELETE: `src/renderer/src/components/agents/ConsoleLine.tsx`
- DELETE/RENAME: `src/renderer/src/components/agents/ConsoleLine.css` → `src/renderer/src/components/agents/cards/ConsoleCard.css`
- NEW: `src/renderer/src/components/agents/cards/ConsoleCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/StartedCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/TextCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/UserMessageCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/ThinkingCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/ToolCallCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/ToolPairCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/ToolGroupCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/StderrCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/ErrorCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/RateLimitedCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/CompletionCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/PlaygroundCard.tsx`
- NEW: `src/renderer/src/components/agents/cards/util.ts`
- MODIFY: `src/renderer/src/components/agents/AgentConsole.tsx` (import + JSX usage only)
- MODIFY: `src/renderer/src/components/agents/__tests__/ConsoleLine.test.tsx` → split or rename to per-card tests

## How to Test

1. **`ConsoleLine.tsx` is gone:**
   ```bash
   ls src/renderer/src/components/agents/ConsoleLine.tsx 2>&1
   ```
   Expected: file not found.
2. **All card files exist:**
   ```bash
   ls src/renderer/src/components/agents/cards/*.tsx | wc -l
   ```
   Expected: 13 (12 card components + ConsoleCard router).
3. **Tests pass:**
   ```bash
   npm run typecheck && npm test && npm run lint
   ```
   All must pass. Test files for the old `ConsoleLine` must be updated to test the new card components, but assertions should be the SAME (rendered DOM is identical).
4. **Visual diff = zero:** the running app should look pixel-identical to before this task. No card chrome, no new icons, no spacing changes.

## Out of Scope

- Any visual change (cards, spacing, icons, colors, typography)
- Card grammar implementation (tasks 05 + 06)
- Tool icon replacement (still single letters in this task)
- Changes to `pair-events.ts`, `tool-summaries.ts`, `render-agent-markdown.tsx`
- Changes to `CollapsibleBlock.tsx`
- Header changes (separate task 03)
