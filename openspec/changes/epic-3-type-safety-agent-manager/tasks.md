## 1. T-18 — Add `process` to `AgentHandle`; remove `as any` in `watchdog-loop.ts`

- [x] 1.1 In `src/main/agent-manager/types.ts`, add `readonly process?: import('child_process').ChildProcess | null` to the `AgentHandle` interface, after the `onStderr` property. Add a one-line JSDoc comment: `/** Subprocess handle exposed by CLI and opencode adapters; undefined on SDK paths. */`
- [x] 1.2 In `src/main/agent-manager/watchdog-loop.ts`, remove the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment and the `as any` cast on line 92 (`forceKillAgent`). Replace `(agent.handle as any).process` with `agent.handle.process`.
- [x] 1.3 In `src/main/agent-manager/watchdog-loop.ts`, remove the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment and the `as any` cast on line 133 (`abortAgent`). Replace `(agent.handle as any).process` with `agent.handle.process`.
- [x] 1.4 Run `npm run typecheck` — confirm zero errors.
- [x] 1.5 In `src/main/agent-manager/__tests__/watchdog-loop.test.ts` (create the file if it does not exist, following the pattern of `watchdog.test.ts`), add a test: "`forceKillAgent` calls `.process.kill('SIGKILL')` when the handle exposes a process" — construct a mock `ActiveAgent` whose `handle.process` is a mock with a `kill` spy; assert `kill` was called with `'SIGKILL'` after `forceKillAgent(agent, logger)`.
- [x] 1.6 Add a test: "`abortAgent` calls `.process.kill('SIGKILL')` when the handle exposes a process" — same pattern as 1.5 but calling `abortAgent`.

## 2. T-4 — Narrow double-cast in `local-adapter.ts`

- [x] 2.1 In `src/main/agent-manager/local-adapter.ts`, replace `return handle as unknown as AgentHandle` with `return handle as AgentHandle`. Add a comment on the line above explaining the structural compatibility: `// spawnBdeAgent returns a structurally compatible handle — messages iterable, abort(), steer() all present.`
- [x] 2.2 Run `npm run typecheck` — confirm zero errors (the single cast is still valid since the external package does not export a type that directly extends `AgentHandle`).
- [x] 2.3 Run `npm run lint` — confirm zero new eslint errors.

## 3. T-32 — Replace `console` cast with `createLogger` in `oauth-checker.ts`

- [x] 3.1 In `src/main/agent-manager/oauth-checker.ts`, add `import { createLogger } from '../logger'` at the top of the file (after the existing `getDefaultCredentialService` import).
- [x] 3.2 Add a module-level constant: `const logger = createLogger('oauth-checker')` directly above `invalidateCheckOAuthTokenCache`.
- [x] 3.3 Replace `getDefaultCredentialService(console as unknown as Logger)` with `getDefaultCredentialService(logger)`.
- [x] 3.4 Remove the `as unknown as Logger` cast — the `Logger` type import (if it was only used for the cast) is no longer needed; remove it if unused.
- [x] 3.5 Run `npm run typecheck` and `npm run lint` — confirm zero errors.

## 4. T-33 — Remove unnecessary constructor cast in `opencode-session-mcp.ts`

- [x] 4.1 In `src/main/agent-manager/opencode-session-mcp.ts`, extend the existing `@modelcontextprotocol/sdk/server/streamableHttp.js` import to also import `StreamableHTTPServerTransportOptions` (named import on the same line as `StreamableHTTPServerTransport`).
- [x] 4.2 In `handleRequest`, replace the inline anonymous object literal with a typed const:
  ```typescript
  const transportOptions: StreamableHTTPServerTransportOptions = {
    sessionIdGenerator: undefined,
    enableDnsRebindingProtection: true,
    allowedHosts: ['127.0.0.1', 'localhost', `127.0.0.1:${port}`, `localhost:${port}`],
    allowedOrigins: [`http://127.0.0.1:${port}`, `http://localhost:${port}`]
  }
  const transport = new StreamableHTTPServerTransport(transportOptions)
  ```
- [x] 4.3 Remove the `as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]` cast entirely.
- [x] 4.4 Run `npm run typecheck` — confirm zero errors.

## 5. T-29 — Define `McpServerRegistrar`; remove four `as any` casts in `safe-tool-handler.ts`

- [x] 5.1 In `src/main/mcp-server/safe-tool-handler.ts`, add a file-local interface directly above `wrapRegistrationMethod`:
  ```typescript
  interface McpServerRegistrar {
    tool: (...args: unknown[]) => unknown
    registerTool: (...args: unknown[]) => unknown
  }
  ```
- [x] 5.2 At the top of `wrapRegistrationMethod`, add: `const registrar = server as unknown as McpServerRegistrar` (one cast, narrowed to the minimal interface). This replaces all four inline casts.
- [x] 5.3 Replace `(server as any)[methodName]` (line 58) with `registrar[methodName]`.
- [x] 5.4 Replace `(existing as (...args: any[]) => unknown).bind(server)` (line 61) — `existing` is now `registrar[methodName]`, which is typed as `(...args: unknown[]) => unknown`. Remove the cast; call `.bind(server)` directly on the typed value.
- [x] 5.5 Replace `const wrapped = (...args: any[]): unknown => {` (line 63) with `const wrapped = (...args: unknown[]): unknown => {`. The body already uses `args` as `unknown[]` idiomatically.
- [x] 5.6 Replace `(server as any)[methodName] = wrapped` (line 76) with `registrar[methodName] = wrapped`.
- [x] 5.7 Remove all four `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments that guarded the removed casts.
- [x] 5.8 Run `npm run typecheck` and `npm run lint` — confirm zero errors and zero remaining `eslint-disable` comments in this file.
- [x] 5.9 Run `npm test` — confirm the full test suite passes.
