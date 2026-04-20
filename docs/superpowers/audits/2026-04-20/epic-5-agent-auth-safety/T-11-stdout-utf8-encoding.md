# T-11 · Pass `{ encoding: 'utf8' }` to execFile in auth-guard

**Severity:** P2 · **Audit lens:** type-safety

## Context

`src/main/auth-guard.ts:10` does `resolve({ stdout: stdout as string, stderr: stderr as string })`. `child_process.execFile` without an explicit `encoding` option returns `string | Buffer` — the cast bypasses the union instead of constraining the call. On an engine quirk a Buffer could land where a string is claimed, and downstream `.trim()` would implicitly `.toString()` without the type system catching it.

## Files to Change

- `src/main/auth-guard.ts` (the local `execFileAsync` helper at lines 6–13)

## Implementation

Pass `{ encoding: 'utf8' }` to `execFile` so the child-process types return `string, string` directly. Remove the two `as string` casts.

```ts
function execFileAsync(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) return reject(err)
      resolve({ stdout, stderr })
    })
  })
}
```

## How to Test

```bash
npm run typecheck
npm run test:main -- auth-guard
npm run lint
```

The existing auth-guard.test.ts suite covers both success and error branches — assert it stays green.

## Acceptance

- No `as string` casts on the `stdout`/`stderr` values in `auth-guard.ts`.
- `execFile` is called with `{ encoding: 'utf8' }` as the third positional arg.
- `typecheck` green; `auth-guard.test.ts` passes; no new lint errors.
