# T-13 · Fix typo `pruneTakeChangesInterval` → `pruneTaskChangesInterval`

**Severity:** P3 · **Audit lens:** clean-code

## Context

`src/main/bootstrap.ts:286` declares a local `setInterval` handle as `pruneTakeChangesInterval`. It's meant to be `pruneTaskChangesInterval` — the misspelling was caught by the audit but never fixed. Names are vocabulary; a misspelled name invites future readers to misread what the code does.

## Files to Change

- `src/main/bootstrap.ts` (line 286 and the matching `clearInterval(...)` call a few lines below)

## Implementation

Rename `pruneTakeChangesInterval` to `pruneTaskChangesInterval` at the declaration site and every reference. There should be exactly two references (the `setInterval` assignment and the `app.on('will-quit', () => clearInterval(...))` cleanup).

No behavior change.

## How to Test

```bash
npm run typecheck
npm run lint
npm run test:main -- bootstrap
```

No new tests needed — a rename is trivially verified by the compiler. Confirm tests still green.

## Acceptance

- `grep pruneTakeChangesInterval src/` returns nothing.
- `grep pruneTaskChangesInterval src/main/bootstrap.ts` shows two hits (declaration + cleanup).
- Full main test suite green.
