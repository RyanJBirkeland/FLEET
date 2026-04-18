# errors

**Layer:** main/mcp-server
**Source:** `src/main/mcp-server/errors.ts`

## Purpose

Translates service exceptions and domain rule violations into JSON-RPC error bodies. Provides `McpDomainError` for throwing domain-specific errors and `toJsonRpcError()` for converting caught exceptions to standardized RPC response format.

## Public API

- `McpErrorCode` — enum of domain error types: `NotFound` (-32001), `InvalidTransition` (-32002), `Cycle` (-32003), `ForbiddenField` (-32004)
- `McpDomainError` — thrown by tool handlers when a domain rule fails; carries error code, message, and optional context data
- `JsonRpcErrorBody` — interface for the mapped error response: `{ code: number; message: string; data?: unknown }`
- `toJsonRpcError(err)` — converts zod validation errors (-32602), domain errors (domain-specific codes), or unknown errors (-32603) to `JsonRpcErrorBody`

## Key Dependencies

- `zod` — for `ZodError` detection and issue extraction
