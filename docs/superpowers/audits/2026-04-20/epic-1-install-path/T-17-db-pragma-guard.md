# T-17 · Guard the `user_version` pragma cast in db.ts

**Severity:** P3 · **Audit lens:** type-safety

## Context

`src/main/db.ts:111` does `db.pragma('user_version', { simple: true }) as number`. better-sqlite3 types `pragma()` as returning `unknown` — the cast to `number` is conventional but skips a `typeof` check. A driver or version change that returns a `string` or `bigint` would fail silently; the migration loader would compare `currentVersion < migration.version` against a non-number and misbehave with no typecheck error.

## Files to Change

- `src/main/db.ts` (around line 111 — the pragma call that reads the schema version)

## Implementation

Wrap the cast in a runtime guard. Replace:

```ts
const currentVersion = db.pragma('user_version', { simple: true }) as number
```

with:

```ts
const rawVersion = db.pragma('user_version', { simple: true })
if (typeof rawVersion !== 'number') {
  throw new Error(
    `PRAGMA user_version returned non-number value: ${JSON.stringify(rawVersion)} (type: ${typeof rawVersion})`
  )
}
const currentVersion = rawVersion
```

The thrown error path is defensive — it should never fire in practice, but if better-sqlite3 ever changes its return shape, the migration loader fails loudly instead of silently reading `NaN`.

## How to Test

```bash
npm run typecheck
npm run test:main -- db
npm run test:main -- migrations
```

The existing db/migration test suites exercise the happy path (numeric pragma result). The guard's throw branch is hard to hit without mocking better-sqlite3, which is overkill — a narrative comment in the guard is enough. Optional: add one test that monkey-patches `db.pragma` to return a string and asserts the throw.

## Acceptance

- No `as number` cast on `db.pragma('user_version', ...)`.
- A runtime check throws a named error on non-number pragma result.
- Full main test suite green.
