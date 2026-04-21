# repos-cache

**Layer:** MCP Server
**Source:** `src/main/mcp-server/repos-cache.ts`

## Purpose
Memoize the parsed `repos` setting so the hot `meta.repos` MCP tool doesn't re-hit SQLite and `JSON.parse` on every call. The cache invalidates the moment a user edits repos in Settings — `emitSettingChanged` fires from the config handlers, so the next read reflects the new value without a stale window.

## Public API
- `createReposCache(options?)` — Returns a `ReposCache` handle bound to the current settings DB and the in-process `settings-changed` event bus.
- `ReposCache.getRepos()` — Returns the current `RepoConfig[]` (empty array when no repos are configured); hits the underlying reader only when the cache is cold.
- `ReposCache.invalidate()` — Drops the in-memory value so the next `getRepos()` re-reads from settings.
- `ReposCache.dispose()` — Tears down the settings-changed subscription. Test-only cleanup hook; the production `createMcpServer()` instance lives for the lifetime of the app.
- `ReposCacheOptions` — Test seams: `readRepos` overrides the settings reader; `subscribe` overrides the settings-changed subscription.

## Key Dependencies
- `settings.ts` — `getSettingJson<RepoConfig[]>('repos')` default reader
- `events/settings-events.ts` — `onSettingChanged` default subscription; invalidates when `event.key === 'repos'`
- `paths.ts` — `RepoConfig` type
