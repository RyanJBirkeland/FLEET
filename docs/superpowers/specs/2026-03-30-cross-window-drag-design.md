# Cross-Window Drag — Design Spec

**Date:** 2026-03-30
**Status:** Draft
**Prerequisite:** Tear-off windows Phase 1 (merged)

## Overview

Enable dragging a tab from a tear-off window back into the main window (or another tear-off), with the same 5-zone drop targeting (top/bottom/left/right/center) as internal drag-and-drop. When the last tab leaves a tear-off, the window closes automatically.

## Requirements

- **Trigger:** Drag tab from tear-off window, cursor enters another BDE window
- **Drop targeting:** Full 5-zone system — split panel or add as tab, same as internal DnD
- **Last-tab behavior:** Tear-off closes automatically when its only tab is dragged out
- **Cancel:** Escape key or releasing on empty desktop cancels the cross-window drag
- **Fallback:** If cursor leaves a tear-off but doesn't enter another BDE window, Phase 1 behavior applies (create a new tear-off at cursor)

## Architecture

### Data Flow

```
Tear-off Window                    Main Process                     Main Window
─────────────                    ─────────────                     ───────────
1. User drags tab
2. Cursor leaves window
3. useTearoffDrag fires
                          ──→  4. tearoff:dragOut
                                5. getCursorScreenPoint()
                                   Is cursor over another window?
                          ──→  6. tearoff:dragIn { viewKey, screenX, screenY }
                                                                   7. useCrossWindowDrop activates
                                                                      synthetic overlay
                          ──→  8. tearoff:dragMove { screenX, screenY }
                                   (16ms interval while active)    9. Overlay tracks cursor,
                                                                      shows 5-zone highlights
                                                                   10. mouseup detected
                          ←──  11. tearoff:dropComplete { viewKey, targetPanelId, zone }
                                12. Relay to source window:
                          ──→      tearoff:dragDone
13. Close self (last tab)
                                                                   14. addTab/splitPanel
```

### IPC Channels (6 new)

| Channel | Pattern | Direction | Payload | Purpose |
|---------|---------|-----------|---------|---------|
| `tearoff:dragOut` | send | source-renderer → main | `{ windowId, viewKey }` | Tab drag exited source window |
| `tearoff:dragIn` | send | main → target-renderer | `{ viewKey, screenX, screenY }` | Incoming tab — show drop overlay |
| `tearoff:dragMove` | send | main → target-renderer | `{ screenX, screenY }` | Cursor position update during drag |
| `tearoff:dragCancel` | send | main → all renderers | `{}` | Drag cancelled — hide overlays |
| `tearoff:dropComplete` | send | target-renderer → main | `{ viewKey, targetPanelId, zone }` | Tab dropped — execute the move |
| `tearoff:dragDone` | send | main → source-renderer | `{}` | Drop succeeded — source can close |

### Component Map

```
Main Process
├── tearoff-manager.ts       — add cross-window drag coordinator
│   ├── handleDragOut()      — start cursor polling, detect target window
│   ├── handleDropComplete() — relay to source, execute tab add
│   └── cancelDrag()         — cleanup on Escape/timeout

Renderer (all windows)
├── hooks/useTearoffDrag.ts          — MODIFY: detect cross-window vs new-window
├── hooks/useCrossWindowDrop.ts      — NEW: synthetic overlay for incoming drags
├── components/panels/CrossWindowDropOverlay.tsx — NEW: visual overlay during cross-window drag
```

### Main Process: Cross-Window Drag Coordinator

Added to `tearoff-manager.ts`:

```typescript
interface ActiveDrag {
  sourceWindowId: string
  viewKey: string
  pollInterval: ReturnType<typeof setInterval>
  targetWindowId: number | null  // BrowserWindow.id of window under cursor
}

let activeDrag: ActiveDrag | null = null
```

**`handleDragOut(sourceWindowId, viewKey)`:**
1. Store as `activeDrag`
2. Start 16ms interval polling `screen.getCursorScreenPoint()`
3. For each tick, find which BrowserWindow (if any) contains the cursor point
4. If cursor enters a new window → send `tearoff:dragIn` to that window
5. Send `tearoff:dragMove` with screen coords to the target window
6. If cursor leaves all windows → send `tearoff:dragCancel` to previous target

**`handleDropComplete(viewKey, targetPanelId, zone)`:**
1. Stop cursor polling
2. Send `tearoff:dragDone` to source window
3. Send `tearoff:tabReturned` to target window (reuse existing channel) with the view + zone info
4. Clear `activeDrag`

**`cancelDrag()`:**
1. Stop cursor polling
2. Send `tearoff:dragCancel` to all windows
3. Clear `activeDrag`

**Timeout:** If no drop occurs within 10 seconds, auto-cancel. Prevents leaked polling intervals.

### Renderer: Modified `useTearoffDrag`

Currently when the 200ms timer fires after cursor leaves the window, it always creates a new tear-off. Change to:

```typescript
// Timer fires — cursor has left the window
if (!dragData.current || tearoffCreated.current) return

// Ask main process: is cursor over another BDE window?
const result = await window.api.tearoff.startCrossWindowDrag({
  windowId: currentWindowId,
  viewKey: dragData.current.viewKey
})

if (result.targetFound) {
  // Cross-window drag initiated — main process is now coordinating
  tearoffCreated.current = true  // suppress further actions
} else {
  // No target window — create new tear-off (Phase 1 behavior)
  tearoffCreated.current = true
  window.api.tearoff.create({ ... })
}
```

This requires a new `tearoff:startCrossWindowDrag` IPC channel (handle) that:
1. Checks `screen.getCursorScreenPoint()` against all window bounds
2. If cursor is over another window → starts the polling coordinator, returns `{ targetFound: true }`
3. If not → returns `{ targetFound: false }`

### Renderer: New `useCrossWindowDrop` Hook

Mounted in `App.tsx` (main window) and `TearoffShell.tsx` (tear-off windows):

```typescript
interface CrossWindowDropState {
  active: boolean
  viewKey: string | null
  screenX: number
  screenY: number
}
```

**Behavior:**
1. Listen for `tearoff:dragIn` → set `active = true`, store viewKey and initial coords
2. Listen for `tearoff:dragMove` → update screenX/screenY
3. Convert screen coords to local window coords: `localX = screenX - window.screenX`, `localY = screenY - window.screenY`
4. Render `CrossWindowDropOverlay` with local coords
5. `CrossWindowDropOverlay` reuses the existing 5-zone hit testing from `PanelDropOverlay` — determines which panel and which zone the cursor is over
6. On `mouseup` (window-level listener while active):
   - Determine target panel + zone from last known coords
   - Send `tearoff:dropComplete` with `{ viewKey, targetPanelId, zone }`
   - Set `active = false`
7. Listen for `tearoff:dragCancel` → set `active = false`, hide overlay
8. Escape key during active drop → send cancel to main process

### `CrossWindowDropOverlay` Component

Reuses the visual language of `PanelDropOverlay`:
- Full-window overlay (position: fixed, inset: 0, z-index: 9999)
- Shows the 5-zone highlight on the panel under the cursor
- Panel detection: walk the `PanelNode` tree, check which leaf's DOM bounds contain the cursor
- Zone detection: same quadrant math as `PanelDropOverlay` (divide panel into 5 regions)
- Visual: same blue/cyan highlight as internal drops

### Last-Tab Auto-Close

When `tearoff:dragDone` arrives at the source tear-off:
1. The tab has been moved to the target window
2. If the tear-off only had one tab → `window.close()` (triggers the normal close flow, but since `isQuitting`-like logic handles it, the window just closes)
3. If it had multiple tabs (Phase 2 multi-tab, future) → just remove the tab

For Phase 2.1 (this spec), tear-offs are single-view, so dragDone always means close.

### Edge Cases

**Cursor returns to source window during drag:**
- Main process detects cursor re-entered the source window
- Sends `tearoff:dragCancel` to any active target
- Drag is cancelled — tab stays in source

**Cursor moves to desktop (no window):**
- Polling detects no window under cursor
- If previously over a target → send `tearoff:dragCancel` to that target
- After 2 seconds on desktop → auto-cancel entire drag (don't create a new tearoff — that's confusing during cross-window drag)

**Multiple tear-off windows:**
- Cross-window drag works between ANY two BDE windows (tearoff→main, tearoff→tearoff, main→tearoff)
- The coordinator just tracks source and current target — doesn't care about window types

**Rapid window switching:**
- If cursor moves from window A to window B quickly:
  1. Send `tearoff:dragCancel` to A
  2. Send `tearoff:dragIn` to B
  3. B shows overlay, A hides overlay

### What Changes in Phase 1 Code

| File | Change |
|------|--------|
| `src/main/tearoff-manager.ts` | Add drag coordinator (handleDragOut, handleDropComplete, cancelDrag, cursor polling) |
| `src/shared/ipc-channels.ts` | Add 7 new channel types (6 above + startCrossWindowDrag) |
| `src/preload/index.ts` + `.d.ts` | Expose new IPC methods |
| `src/renderer/src/hooks/useTearoffDrag.ts` | Modify timer-fire logic to try cross-window first |
| `src/renderer/src/hooks/useCrossWindowDrop.ts` | New hook for receiving cross-window drags |
| `src/renderer/src/components/panels/CrossWindowDropOverlay.tsx` | New overlay component |
| `src/renderer/src/App.tsx` | Mount useCrossWindowDrop hook |
| `src/renderer/src/components/layout/TearoffShell.tsx` | Mount useCrossWindowDrop hook, handle dragDone → close |

### What Does NOT Change

- `PanelDropOverlay.tsx` — internal DnD unchanged
- `panelLayout.ts` — store mutations unchanged (addTab/splitPanel work as-is)
- `tearoff-manager.ts` Phase 1 code — creation/close flows untouched

## Testing Strategy

**Unit tests:**
- Drag coordinator: cursor polling → target detection → IPC relay
- `useCrossWindowDrop`: state transitions (inactive → active → drop/cancel)
- `CrossWindowDropOverlay`: zone detection from local coordinates
- `useTearoffDrag` modification: cross-window vs new-window branching

**Integration tests:**
- Full IPC round-trip: dragOut → dragIn → dragMove → dropComplete → dragDone
- Cancel flow: dragOut → dragCancel
- Timeout: drag without drop for 10s → auto-cancel

**Manual tests:**
- Drag tab from tear-off into main window — 5-zone targeting works
- Drop into center of panel → tab added
- Drop into edge zone → panel splits
- Escape during cross-window drag → cancelled, tab stays in source
- Drag between two tear-off windows
- Last tab dragged out → source tear-off closes

## Non-Goals

- Drag from main window to tear-off (use "Open in New Window" context menu instead)
- Tab reordering across windows
- Shared Zustand state between windows
