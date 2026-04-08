# Kill confirmation: show uncommitted work preview before destroying it

## Problem

In `src/renderer/src/components/agents/ConsoleHeader.tsx`, the stop/kill button (`handleStop`, ~lines 70-78) is a single click that calls `window.api.killAgent(...)` with no confirmation and no preview of what the agent is about to lose. Pipeline agents have worktrees; killing them mid-edit can leave many uncommitted files on disk with no warning to the user.

Bravo Senior Dev flagged this as MINOR but it's actually higher-impact given how often kill is the only escape for a thrashing agent:

> "Pipeline agents have worktrees. Killing them mid-edit can leave uncommitted work. I want to know what I'm losing before I click."

## Solution

Replace the one-click kill with a two-step flow:

1. **First click on Stop** — instead of killing, open a confirm dialog via BDE's existing confirm utility (grep for `useConfirm` or `confirm({` in `src/renderer/src/` to find the pattern — ReviewActions.tsx uses `confirm({...})` from `stores/confirm`).
2. **Dialog content:**
   - Title: "Stop agent?"
   - Body: "This agent has uncommitted changes in its worktree. Killing it will leave those changes on disk but will not commit or push them."
   - A "What will be lost?" expandable section that shows the output of `git status --short` in the agent's worktree. You'll need a new IPC channel `git:statusInWorktree` (or reuse `git:status` if it accepts an explicit path) that returns the short git status for a given path. If such a channel exists, use it; if not, add it to `git-handlers.ts` with the same pattern as the other git handlers.
3. **Confirm label:** "Stop agent"; **variant:** `'danger'` (if the confirm API supports it)
4. **On confirm** — proceed with the existing `window.api.killAgent(killId)` call.
5. **On cancel** — do nothing.
6. **Edge case:** if the agent has no worktree (adhoc assistant running in repo dir), skip the git status check and show a simpler dialog: "Stop agent? This will terminate the SDK session." Still requires confirmation.

Don't change the actual kill path. Don't add any new terminal states. Just wrap the button with a confirmation.

## Files to Change

- `src/renderer/src/components/agents/ConsoleHeader.tsx` — wrap `handleStop` with a confirm dialog
- `src/main/handlers/git-handlers.ts` — add `git:statusInWorktree` IPC channel if it doesn't already exist. Check first via grep before adding.
- `src/shared/ipc-channels.ts` — add the channel type if a new one was needed
- `src/preload/index.ts` — expose the new channel if added

If `git:status` already accepts an explicit path, reuse it and skip the new channel entirely.

## How to Test

1. `npm run typecheck` — 0 errors
2. `npm run test:coverage` — all tests pass. Re-run individually on any failure before concluding anything.
3. `npm run test:main` — all tests pass
4. `npm run lint` — 0 errors
5. `grep -n "killAgent" src/renderer/src/components/agents/ConsoleHeader.tsx` — the `killAgent` call should still exist, but now inside a confirmation callback.
6. Existing tests that simulate clicking Stop and expect immediate kill must be updated to either answer the confirm OR mock the confirm store to auto-confirm.

## Out of Scope

- Changing the IPC kill path itself
- Showing a full diff preview (just `git status --short` is enough)
- Auto-committing uncommitted work before kill
- Adding a "Stop and commit" option
- Touching any other button in ConsoleHeader
- Running `git diff` or diff parsing
