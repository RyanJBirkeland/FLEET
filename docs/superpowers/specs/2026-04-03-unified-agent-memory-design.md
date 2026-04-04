# Unified Agent Memory — Design Spec

## Summary

Combine BDE's two memory systems so that user-created memory files (`~/.bde/memory/`) can be injected into agent prompts alongside the built-in convention modules. Users get a per-file toggle to control which files are "active" — active files are concatenated and included in every agent's prompt. Built-in BDE conventions (IPC, testing, architecture) remain locked and always-injected.

This gives users the ability to train and tune their agents with project-specific knowledge, coding preferences, and domain context — without modifying BDE's internal behavior.

## Goals

- Users can see exactly what knowledge their agents receive
- Users can toggle individual memory files on/off for agent injection
- Active file state is persisted across sessions
- Soft warning when total active memory size gets large
- Built-in BDE convention modules remain immutable and always-on
- Zero impact on users who don't use the feature (no active files = no change)

## Non-Goals

- Per-agent-type file targeting (all agents see the same active set)
- Editing or overriding built-in convention modules
- Hard enforcement of prompt size limits
- Automatic relevance filtering or RAG-style retrieval

## Data Layer

### Setting Key

`memory.activeFiles` in SQLite `settings` table, stored as JSON via `setJson()`/`getJson()`.

**Format:** `Record<string, boolean>` — keys are relative file paths within `~/.bde/memory/`, values are `true`. Only active files are stored; absence means inactive.

```json
{
  "api-patterns.md": true,
  "projects/bde-conventions.md": true
}
```

### getUserMemory()

New **synchronous** function in `src/main/agent-system/memory/user-memory.ts` (uses `readFileSync` to preserve `buildAgentPrompt()`'s sync signature — acceptable since this runs in the main process at agent spawn, not a hot path):

1. Read `memory.activeFiles` setting via `getJson()`
2. For each active path, read the file from `~/.bde/memory/` via `readFileSync`
3. Filter out entries where the file no longer exists (drift cleanup — stale keys pruned and written back via `setJson()`)
4. Concatenate file contents with `---` separators, each prefixed with `### {filename}` header
5. Return `{ content: string, totalBytes: number, fileCount: number }`

Called by `buildAgentPrompt()` alongside the existing `getAllMemory()`.

### Prompt Injection Point

In `prompt-composer.ts`, after the existing `## BDE Conventions` section (which remains unchanged), add a new `## User Knowledge` section containing the output of `getUserMemory().content`. Only added if `fileCount > 0`.

```
## BDE Conventions          ← existing, locked
[ipc-conventions]
[testing-patterns]
[architecture-rules]

## User Knowledge            ← new section
### api-patterns.md
[user file content]
---
### projects/bde-conventions.md
[user file content]
```

## UI Changes

### Memory Sidebar (file list)

Each file row gets a small toggle icon (e.g., `Brain` from lucide-react) on the right side:

- **Active:** Icon is highlighted (accent color), tooltip "Included in agent prompts"
- **Inactive:** Icon is dimmed/muted, tooltip "Not included in agent prompts"
- Clicking the icon toggles the state without selecting/opening the file
- Toggle writes the updated `memory.activeFiles` setting via `settings:set` IPC

### Memory Editor Toolbar

When a file is open, the toolbar (next to Save/Discard) shows:

- A toggle switch or button: "Agent Knowledge: On/Off"
- Mirrors the sidebar toggle — clicking either one updates both
- Visual state matches the sidebar icon (accent when active, muted when inactive)

### Size Warning Banner

Below the editor toolbar, a contextual banner shows:

- **Always visible when any files are active:** "{N} files active ({X} KB total)"
- **Warning state (amber)** when total exceeds 30KB: "Large memory may slow agent responses"
- **No banner** when zero files are active

The 30KB threshold is a soft guideline — no enforcement, just visual feedback.

### Active Files Summary

At the top of the Memory sidebar (below the header, above the file list), show a small summary line:

- "{N} files active for agents" when N > 0
- Nothing when N = 0

This gives users an at-a-glance count without opening each file.

## IPC Changes

### New Channel: `memory:getActiveFiles`

Returns the current `memory.activeFiles` setting as `Record<string, boolean>`. Convenience channel so the renderer doesn't need to know the setting key name.

### New Channel: `memory:setFileActive`

Params: `{ path: string, active: boolean }`

Reads current `memory.activeFiles`, adds/removes the key, writes back. Returns the updated map. This is a single IPC round-trip (no renderer-side read-modify-write race). Note: concurrent calls from multiple tear-off windows could theoretically race in the main process, but this is acceptable given the low frequency of toggle operations.

### Extended: `memory:listFiles`

Add an `active: boolean` field to each file in the response, derived by checking the file's path against `memory.activeFiles`. This avoids a separate round-trip to get active state for the sidebar.

## Existing Code Changes

### `src/main/agent-system/memory/index.ts`

No changes. `getAllMemory()` continues to return only built-in conventions.

### `src/main/agent-manager/prompt-composer.ts`

Import `getUserMemory` from the new `user-memory.ts`. In `buildAgentPrompt()`, after the `## BDE Conventions` block, conditionally append:

```typescript
const userMem = getUserMemory()
if (userMem.fileCount > 0) {
  prompt += '\n\n## User Knowledge\n'
  prompt += userMem.content
}
```

### `src/main/fs.ts`

Update `listMemoryFiles()` to accept an optional `activeFiles` map and include `active: boolean` on each returned file object.

### `src/renderer/src/components/settings/MemorySection.tsx`

- Add state for `activeFiles: Record<string, boolean>` loaded on mount via `memory:getActiveFiles`
- Add toggle handler that calls `memory:setFileActive` and updates local state
- Add toggle icon to each file row in the sidebar
- Add toggle in editor toolbar
- Add size warning banner (sum of `file.size` for all active files)
- Add summary line at top of sidebar

### `src/renderer/src/services/memory.ts`

Add `getActiveFiles()` and `setFileActive(path, active)` service functions.

### `src/preload/index.ts` + `src/preload/index.d.ts`

Add `memory.getActiveFiles` and `memory.setFileActive` to the preload bridge.

## Handler Module

The two new IPC channels (`memory:getActiveFiles`, `memory:setFileActive`) are added to `registerFsHandlers()` in `src/main/fs.ts`, collocated with the existing memory handlers. The settings accessor (`getJson`/`setJson`) is imported as needed.

## File Inventory

| File                                                     | Change                                                                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/agent-system/memory/user-memory.ts`            | **New** — `getUserMemory()` function                                                                                               |
| `src/main/agent-system/memory/index.ts`                  | No change                                                                                                                          |
| `src/main/agent-manager/prompt-composer.ts`              | Import + inject user memory                                                                                                        |
| `src/main/fs.ts`                                         | Extend `listMemoryFiles` with active flag + 2 new handlers                                                                         |
| `src/main/handlers/memory-search.ts`                     | No change                                                                                                                          |
| `src/main/index.ts`                                      | No change (handlers already in `registerFsHandlers()`)                                                                             |
| `src/shared/ipc-channels.ts`                             | Add `memory:getActiveFiles` and `memory:setFileActive` channel types; extend `memory:listFiles` result type with `active: boolean` |
| `src/preload/index.ts`                                   | Add 2 new bridge methods                                                                                                           |
| `src/preload/index.d.ts`                                 | Add 2 new type declarations                                                                                                        |
| `src/renderer/src/services/memory.ts`                    | Add 2 service functions                                                                                                            |
| `src/renderer/src/components/settings/MemorySection.tsx` | Toggle UI, banner, summary                                                                                                         |
| `src/renderer/src/assets/memory.css`                     | Styles for toggle, banner, summary                                                                                                 |

## Testing

- **Unit:** `getUserMemory()` — returns empty when no active files, reads correct files, handles missing files gracefully, calculates byte total, prunes stale keys
- **Unit:** `memory:setFileActive` handler — adds/removes keys, read-modify-write
- **Unit:** `memory:listFiles` — includes `active` field matching setting state
- **Unit:** `buildAgentPrompt()` — includes `## User Knowledge` section when active files exist, omits when none
- **Unit:** Handler count test for `registerFsHandlers()` — update expected count from 3 to 5 (adding `memory:getActiveFiles` and `memory:setFileActive`)
- **Renderer:** MemorySection — toggle renders, click updates state, banner appears at threshold, summary shows correct count

## Edge Cases

- **File deleted externally:** `getUserMemory()` drops missing files from the active set and writes the pruned map back to settings. Next `listFiles` call won't include it, so the UI self-heals.
- **Empty file toggled active:** Included but contributes 0 bytes. No special handling needed.
- **Very large file:** No hard limit. Soft warning covers this via total byte count.
- **No memory files exist:** Feature is invisible — no banner, no toggles, no prompt injection. Zero overhead.
- **Setting doesn't exist yet:** `getJson('memory.activeFiles')` returns `null` → treated as empty `{}`.
