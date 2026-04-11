# CR Redesign 02 — Three-column shell + TopBar + delete ReviewDetail

## Goal

Replace the Code Review view's two-panel layout with the three-column shell (FileTree / DiffViewer / AIAssistant) and introduce the `TopBar` component. Delete `ReviewDetail.tsx` and `ConversationTab.tsx`. AIAssistant column is a placeholder — Task 3 fills it in.

Full reference: `docs/superpowers/specs/2026-04-10-code-review-redesign-design.md` §4.1, §5.1, §5.2, §5.4. Depends on Task 1 (`FileTreePanel` must exist).

## Files to Change

- `src/renderer/src/views/CodeReviewView.tsx` — replace `.view-layout` with `.cr-topbar` + `.cr-panels` tree. Mount `<TopBar />`, `<FileTreePanel />`, `<DiffViewerPanel />`, and a placeholder `<section className="cr-assistant cr-assistant--placeholder">AI Assistant</section>` in the right column.
- `src/renderer/src/views/CodeReviewView.css` — full rewrite. Add `.cr-topbar` (44px, flex row, `flex-shrink: 0`, bottom border), `.cr-panels` (flex row, `flex: 1 1 auto; min-height: 0`), `.cr-filetree` (256px, `flex-shrink: 0`), `.cr-diffviewer` (`flex: 1 1 0; min-width: 0`), `.cr-assistant` (384px, `flex-shrink: 0`).
- `src/renderer/src/components/code-review/TopBar.tsx` + `.css` — **new**. Three flex zones: left (task switcher button + popover mounting `<ReviewQueue />`), center (freshness badge + Rebase button), right (Ship It / Merge + strategy / Create PR / kebab with Revise & Discard). Reuse `ReviewActions.tsx` logic — move its JSX into TopBar or mount the component inside the right zone; no prop changes.
- `src/renderer/src/components/code-review/DiffViewerPanel.tsx` + `.css` — **new**. Header with breadcrumb (read `selectedDiffFile` from store) + segmented control `Diff | Commits | Tests`. Body renders `<ChangesTab />` / `<CommitsTab />` / `<TestsTab />` by current mode. Active pill: `background: var(--bde-accent-surface); color: var(--bde-accent)`.
- `src/renderer/src/stores/codeReview.ts` — add `diffMode: 'diff' | 'commits' | 'tests'` (default `'diff'`) + setter. Reset to `'diff'` on task switch.
- `src/renderer/src/components/code-review/ReviewDetail.tsx` + `.css` + test — **delete**.
- `src/renderer/src/components/code-review/ConversationTab.tsx` + `.css` + test — **delete**.
- `src/renderer/src/components/code-review/ReviewQueue.tsx` + `.css` — strip the fixed-width `<aside>` wrapper. Keep list/item/j+k logic unchanged.
- `src/renderer/src/components/code-review/__tests__/TopBar.test.tsx` — **new** — renders with selected task; Ship It / Merge / PR / Revise buttons present; task switcher opens popover.
- `src/renderer/src/components/code-review/__tests__/DiffViewerPanel.test.tsx` — **new** — default mode shows Changes; clicking `Commits` pill shows Commits.

## Implementation notes

- Task switcher popover: `role="dialog" aria-modal="true"`, anchored under the button, mounts `<ReviewQueue />` as its body. Escape closes.
- `j`/`k` still works because the keyboard listener lives on `ReviewQueue` and its element mounts into the popover DOM.
- Leave `BatchActions.tsx` rendering unchanged at the view root — Task 4 folds it into TopBar.
- Compact tokens only: no hardcoded pixel values except the 44px TopBar, the 256/384 column widths, and the 36px DiffViewer header.

## How to Test

```bash
npm run typecheck
npm test -- code-review
npm run test:main
npm run lint
```

Manual: `npm run dev`, open Code Review. You should see 44px TopBar, 256px FileTree column with files, flex-1 center DiffViewer, 384px placeholder right column. Files selectable. Task switcher in TopBar opens a popover with the queue. `j`/`k` navigates. Ship It / Merge / PR all still work. Verify both themes.

Branch: `feat/cr-redesign-02-shell`. PR title: `feat: CR Redesign 02 — three-column shell + TopBar`.
