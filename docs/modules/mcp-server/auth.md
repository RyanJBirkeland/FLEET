# auth

**Layer:** MCP Server
**Source:** `src/main/mcp-server/auth.ts`

## Purpose
Bearer-token authentication middleware for HTTP requests. Uses constant-time comparison to prevent timing attacks.

## Public API
- `checkBearerAuth(req, expected)` — validates `Authorization: Bearer <token>` header against expected token; returns `{ ok: true }` or `{ ok: false, status: 401, message }`
- `AuthResult` — union type for auth result

## Key Dependencies
- `node:http` — `IncomingMessage` type for request objects
- `node:crypto` — `timingSafeEqual` for constant-time token comparison
