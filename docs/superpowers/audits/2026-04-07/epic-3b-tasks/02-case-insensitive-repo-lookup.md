# Make `getRepoConfig` case-insensitive + normalize historical drift

## Problem

Currently at `src/main/handlers/review.ts:62-65`:

```ts
function getRepoConfig(repoName: string): RepoConfig | null {
  const repos = getSettingJson<RepoConfig[]>('repos')
  return repos?.find((r) => r.name === repoName) ?? null
}
```

The `r.name === repoName` comparison is case-sensitive. Settings stores `repos: [{ name: 'bde', ... }]` (lowercase), but **~22% of historical tasks in the DB have `repo = 'BDE'` (uppercase)** — leftover from an earlier code path that used inconsistent casing. Running Ship It / Merge Locally / Create PR on any of those historical tasks fails with:

> `Error: Repo "BDE" not found in settings`

The user hit this during the Epic 1 dogfood loop: an inserted task with `repo='BDE'` blocked Ship It until the value was manually patched.

Surfaced as a new finding in the 2026-04-07 audit dogfood-loop appendix.

## Solution

Two changes:

1. **Make the lookup case-insensitive** (defensive). In `src/main/handlers/review.ts:62-65`, change the comparison to:

```ts
function getRepoConfig(repoName: string): RepoConfig | null {
  const repos = getSettingJson<RepoConfig[]>('repos')
  const target = repoName.toLowerCase()
  return repos?.find((r) => r.name.toLowerCase() === target) ?? null
}
```

2. **Add a new migration v38** in `src/main/db.ts` that normalizes existing `sprint_tasks.repo` to lowercase, matching the settings convention. Follow the exact pattern of migrations v36/v37 (single `up: (db) => { ... }` with `db.exec`/`db.prepare`). The migration body:

```
UPDATE sprint_tasks SET repo = lower(repo) WHERE repo <> lower(repo);
```

Use `db.prepare(...).run()` since it's a single parameterless statement.

Do NOT change how new tasks are written (those already use lowercase since the Epic 1 preflight task was inserted correctly). The migration only heals historical rows.

## Files to Change

- `src/main/handlers/review.ts` — case-insensitive `getRepoConfig`
- `src/main/db.ts` — new migration v38 (append to the `migrations` array after v37)
- `src/main/__tests__/db.test.ts` — add a regression test for v38: insert a row with `repo='BDE'` at user_version=37, run migrations, assert the row's repo is now `'bde'`

## How to Test

1. `npm run typecheck` — 0 errors
2. `npm run test:main` — all tests pass. If any fails, re-run just that file in isolation before concluding anything; parallel-load flakes are common when multiple agents run tests simultaneously.
3. `npm run test:coverage` — all tests pass
4. `npm run lint` — 0 errors
5. Manual check: `grep -n "r.name === repoName" src/main/handlers/review.ts` — must return zero matches after the fix.
6. Grep for the new migration: `grep -n "version: 38" src/main/db.ts` — must return at least one match.

## Out of Scope

- Changing how `sprint_tasks.repo` is written in `sprint-queries.ts` (already consistent)
- Enforcing lowercase at the type level
- Adding a UI for managing repo aliases
- Changing any other `.find(r => r.name === ...)` pattern elsewhere in the codebase — if you find one, log it but don't fix it in this task (scope creep)
