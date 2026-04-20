# T-44 · Remove unused `defaultGetRepos` export from `tools/meta.ts`

**Severity:** P3 · **Audit lenses:** clean-code, architecture

## Context

`src/main/mcp-server/tools/meta.ts:63` exports `defaultGetRepos` and imports `getSettingJson` + `RepoConfig` to support it, but nothing in the repo consumes `defaultGetRepos` today. `createMcpServer` in `mcp-server/index.ts:46` inlines its own `getSettingJson<RepoConfig[]>('repos') ?? []` directly. The export is dead code plus a split source of truth for "how meta reads repos."

## Files to Change

- `src/main/mcp-server/tools/meta.ts` (remove `defaultGetRepos`, strip the now-unused settings imports)
- Any test file that references `defaultGetRepos` (should be none — grep to confirm)

## Implementation

1. Confirm no consumer:
```bash
grep -rn "defaultGetRepos" src/
```
If anything references it, stop and escalate — the audit assumed it was dead but verify.

2. Delete the `export function defaultGetRepos()` and its JSDoc.

3. Remove the imports of `getSettingJson` and `RepoConfig` from `meta.ts` if they become unused after the deletion.

4. Run typecheck — any surviving references will surface as compile errors.

## How to Test

```bash
npm run typecheck
npm run test:main -- meta
npm run test:main -- mcp-server
npm run lint
```

## Acceptance

- `defaultGetRepos` is gone.
- `grep defaultGetRepos src/` returns nothing.
- `meta.ts` no longer imports `getSettingJson` or `RepoConfig` (unless some other code in the file still needs them — check).
- Full main test suite green.
