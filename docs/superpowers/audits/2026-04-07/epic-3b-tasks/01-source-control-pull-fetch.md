# Source Control: add Pull and Fetch buttons

## Problem

BDE's Source Control view (`src/renderer/src/views/GitTreeView.tsx` and `src/renderer/src/components/git-tree/CommitBox.tsx`) supports Stage, Unstage, Commit, Push, Branch checkout, and Refresh, but **has no Pull and no Fetch**. Confirmed by grep: `git:pull`, `git:fetch`, `gitPull`, `gitFetch` return zero matches anywhere in `src/`.

The empty-state copy even suggests "pull updates to see changes here" but there's no affordance to do it. Users are forced to leave the app to run `git pull` in a terminal — defeating the purpose of having a Source Control view.

Flagged as CRITICAL by Bravo PM, MAJOR by Bravo Senior Dev.

## Solution

Add two new IPC channels and corresponding UI buttons:

1. **Backend** — add to `src/main/handlers/git-handlers.ts`:
   - `git:fetch` — runs `git fetch origin` in the repo path (no side effects beyond updating remote refs)
   - `git:pull` — runs `git pull --ff-only origin <currentBranch>` in the repo path. Use `--ff-only` so it never creates merge commits; if it can't fast-forward, return `{ success: false, error: 'Local branch has diverged from origin. Resolve manually.' }` instead of throwing.
   - Both channels take `{ repoPath: string }` and return `{ success: boolean, error?: string, stdout?: string }`.
   - Register both in the channel map at `src/shared/ipc-channels.ts` under the existing `GitChannels` domain interface.
   - Expose both in `src/preload/index.ts` under the `git` object, alongside the existing `git.push` / `git.status` etc.

2. **Frontend** — in `src/renderer/src/components/git-tree/CommitBox.tsx` (or wherever the header buttons live — read the file to check; it may be `GitTreeView.tsx` itself), add two buttons next to the existing Push button:
   - **Fetch** — icon-only, lucide `Download`. On click: call `window.api.git.fetch({ repoPath })`. On success, call the existing status-refresh function. On error, show a toast.
   - **Pull** — text + icon, lucide `ArrowDownToLine`. On click: call `window.api.git.pull({ repoPath })`. On success, refresh status and show a toast "Pulled from origin". On error show the error in a toast.

Use `execFileAsync('git', ['fetch', 'origin'], { cwd: repoPath, env: buildAgentEnv() })` — match the existing `git:push` handler's pattern in the same file.

## Files to Change

- `src/main/handlers/git-handlers.ts` — add `git:fetch` and `git:pull` handlers (use `safeHandle`)
- `src/shared/ipc-channels.ts` — add the two channels to `GitChannels` interface
- `src/preload/index.ts` — expose `git.fetch` and `git.pull`
- `src/preload/index.d.ts` — update types if the .d.ts isn't generated
- `src/renderer/src/components/git-tree/CommitBox.tsx` OR `GitTreeView.tsx` — add the buttons

## How to Test

1. `npm run typecheck` — 0 errors
2. `npm run test:coverage` — all tests pass. If any pass-in-isolation fails, re-run that file via `npx vitest run <file>` first to rule out parallel-load flakes before concluding anything.
3. `npm run test:main` — all tests pass. Add a handler test for `git:fetch` and `git:pull` in `src/main/handlers/__tests__/git-handlers.test.ts` if that file exists; otherwise skip.
4. `npm run lint` — 0 errors
5. `grep -n "'git:fetch'\|'git:pull'" src/main/handlers/git-handlers.ts` — must return at least 2 matches.
6. `grep -n "git.fetch\|git.pull" src/preload/index.ts` — must return at least 2 matches.

## Out of Scope

- `git pull --rebase` (separate task)
- Stashing uncommitted changes before pull
- Resolving merge conflicts in the pull path
- Amend commit (separate task)
- Per-file discard (separate task)
- Any new UI for conflict resolution
