# token-store

**Layer:** MCP Server
**Source:** `src/main/mcp-server/token-store.ts`

## Purpose
Persistent bearer token storage for MCP server authentication. Generates a 32-byte random token (64 hex characters) on first read and stores it at `~/.bde/mcp-token` with mode 0600. Subsequent reads return the existing token.

## Public API
- `readOrCreateToken(filePath?: string)` — reads token from disk or generates and writes a new one
- `regenerateToken(filePath?: string)` — overwrites the token file with a new value
- `tokenFilePath()` — returns the default token path (`~/.bde/mcp-token`)

## Key Dependencies
- `node:fs` (promises) — file I/O with explicit mode handling
- `node:crypto` — 32-byte random token generation
- `node:path`, `node:os` — path resolution and home directory lookup
