# CR Redesign 01 — Extract FileTreePanel + hoist selected-file state

## Goal

Extract the file list rendering out of `ChangesTab.tsx` into a new standalone `FileTreePanel` component, and hoist `selectedFile` from `ChangesTab`'s local `useState` into the `codeReview` Zustand store. **No user-visible change.** Pure refactor that prepares the component boundary for the three-column layout in Task 2.

Full reference: `docs/superpowers/specs/2026-04-10-code-review-redesign-design.md` §5.3.

## Files to Change

- `src/renderer/src/stores/codeReview.ts` — add `selectedDiffFile: string | null` + `setSelectedDiffFile(path)` action. Reset to `null` inside `selectTask` and inside `setDiffFiles`.
- `src/renderer/src/components/code-review/FileTreePanel.tsx` — **new**
- `src/renderer/src/components/code-review/FileTreePanel.css` — **new**
- `src/renderer/src/components/code-review/ChangesTab.tsx` — delete the `.cr-changes__files` block (roughly lines 176–190) and the local `selectedFile` state. Read `selectedDiffFile` from the store. Keep the `fileDiff` local state + its `useEffect` as-is (just change its dep key). Update `applySnapshot` to call `setSelectedDiffFile(snap.files[0].path)`.
- `src/renderer/src/components/code-review/ChangesTab.css` — remove any `.cr-changes__file*` rules. Keep `.cr-changes__diff*` and `.cr-changes__snapshot-banner`.
- `src/renderer/src/components/code-review/__tests__/ChangesTab.test.tsx` — drop file-list assertions; keep diff/snapshot assertions.
- `src/renderer/src/components/code-review/__tests__/FileTreePanel.test.tsx` — **new** — render with fake `diffFiles`, click a row, assert `setSelectedDiffFile` called + selected row gets `--selected` modifier class.

## Implementation notes

- `FileTreePanel` wraps in `<aside className="cr-filetree" aria-label="Changed files">`. Header `.cr-filetree__header` with label `Files` + count. Body `.cr-filetree__list` renders rows: status icon (reuse the existing `statusIcon()` helper pattern from ChangesTab, 12px, `lucide-react` `Plus`/`Minus`/`Edit2`) + filename + `+N −N` stats.
- Width `256px`. Use `var(--bde-space-2/3/4)` for padding, `var(--bde-size-sm)` for filename, `var(--bde-size-xs)` + `font-variant-numeric: tabular-nums` for stats. Row height `28px`. Hover `var(--bde-hover)`. Selected: `background: var(--bde-selected)`, `border-left: 2px solid var(--bde-accent)`, compensate with `padding-left: calc(var(--bde-space-4) - 2px)` so width stays stable. Right border `1px solid var(--bde-border)`.
- `FileTreePanel` is **dead code** after this task — no file imports it. Task 2 mounts it. Do not touch `CodeReviewView.tsx` or `ReviewDetail.tsx` in this task.

## How to Test

```bash
npm run typecheck
npm test -- ChangesTab FileTreePanel codeReview
npm test
npm run lint
```

Manual: `npm run dev`, open Code Review view. View looks identical. Click files — diff still loads. Switch tasks — file selection clears.

## Out of Scope

Anything in `CodeReviewView.tsx`, `ReviewDetail.tsx`, the TopBar, the AIAssistant panel, or responsive breakpoints. Those land in Tasks 2–4.

Branch: `feat/cr-redesign-01-filetree`. One commit. PR title: `feat: CR Redesign 01 — extract FileTreePanel + hoist selectedDiffFile`.
