# Agent Launchpad: replace repo click-cycler with a dropdown

## Problem

`src/renderer/src/components/agents/LaunchpadGrid.tsx:131` ("cycler" area around lines 130-140) makes the repo selector a button that increments through the repo array on each click:

```ts
onClick={() => setRepo(repos[(idx + 1) % repos.length]?.label)}
```

With 4-5 repos configured, selecting the 4th requires 3 clicks from the default, with no preview of what's coming next. The chevron `▾` glyph visually implies a dropdown; the behavior is a cycler. This is a bait-and-switch.

Flagged by Bravo PM and Bravo Senior Dev.

## Solution

Replace the click-cycler button with a real dropdown (`<select>` or a popover menu, matching BDE's existing styling for dropdown elements). Requirements:

1. Show all configured repos at once when opened.
2. Selecting an option sets `repo` to that label.
3. Default to the previously-used repo (if persisted in the store) or the first available.
4. Keep the visual placement identical to the current button so the layout doesn't shift.
5. If BDE already has a styled dropdown primitive in `src/renderer/src/components/neon/` or `src/renderer/src/components/ui/`, **prefer that** over a raw `<select>`. Read the neon components directory first to see what's available.
6. Keyboard support: arrow keys to navigate options, Enter to select, Escape to close (whatever the chosen component supports out of the box).

If a shared repo-picker component exists elsewhere (e.g., in Source Control or Settings), consider using it for consistency — but do NOT extract a new shared component as part of this task.

## Files to Change

- `src/renderer/src/components/agents/LaunchpadGrid.tsx` — replace the cycler button with a dropdown

## How to Test

1. `npm run typecheck` — 0 errors
2. `npm run test:coverage` — all tests pass
3. `npm run lint` — 0 errors
4. Run any LaunchpadGrid tests in isolation first before concluding anything about flakes.
5. Any existing tests that simulate the cycler click pattern must be updated to use the new dropdown interaction.

## Out of Scope

- Persisting the "last used repo" across sessions (may already work via the store; don't add new persistence)
- Creating a new shared RepoSelect component
- Changing the model picker (if it's also a cycler — that's a separate task)
- Adding search/filter to the dropdown
