# playground-handler

**Layer:** agent-manager
**Source:** `src/main/agent-manager/playground-handler.ts`

## Purpose
Detects when an agent writes a playground-supported file (`.html`, `.htm`, `.svg`, `.md`, `.markdown`, `.json`) via the Write tool, reads and sanitizes the content with DOMPurify, and broadcasts an `agent:playground` event so the renderer can show a PlaygroundCard. Used by both the pipeline agent message consumer and the adhoc/assistant turn loop.

## SDK wire format

The current Claude Agent SDK emits tool invocations as content blocks inside assistant/user messages:

- **tool_use** block (inside `assistant.message.content[]`) — the model *requests* a tool, carrying `{ id, name, input }`. File does not exist yet.
- **tool_result** block (inside `user.message.content[]`) — the SDK *confirms* the tool ran, carrying `{ tool_use_id, is_error, content }`. File exists.

The detector pairs these by `tool_use_id` so emission only fires *after* the tool_result confirms success. A legacy top-level `{ type: 'tool_result', tool_name, input }` shape is still accepted for back-compat with older wire formats.

## Public API

- `createPlaygroundDetector()` — returns a `PlaygroundDetector` with stateful `onMessage(msg)` that pairs tool_use with tool_result across a single session. Each session (one pipeline run, one adhoc session) must instantiate its own detector — pending writes cross-contaminate otherwise. Returns a hit only on successful tool_result.
- `PlaygroundDetector` — `{ onMessage(msg: unknown): PlaygroundWriteResult | null }`.
- `detectPlaygroundWrite(msg)` — **legacy** pure per-message detector for the top-level `tool_result` format only. Does not handle current SDK content-block messages; new callers should prefer `createPlaygroundDetector`.
- `detectHtmlWrite(msg)` — backward-compat alias returning only the path (string or `null`), delegates to `detectPlaygroundWrite`.
- `tryEmitPlaygroundEvent(request: PlaygroundEmitRequest)` — async I/O function. Reads the file, sanitizes it, and emits the `agent:playground` event. Silently drops the event on timeout, missing file, oversize (>5MB), or sanitization failure.
- `PlaygroundEmitRequest` — `{ taskId, filePath, worktreePath, logger, contentType?, allowAnyPath? }`. `allowAnyPath: true` skips the worktree containment check (used by adhoc/assistant agents whose users may render files outside the worktree). DOMPurify still runs — that is the real security boundary.
- `PlaygroundWriteResult`, `PlaygroundContentType` — shared types.

## Key Dependencies
- `./sdk-message-protocol` — `asSDKMessage` narrows raw messages to the `SDKWireMessage` shape.
- `../agent-event-mapper` — `emitAgentEvent` persists + broadcasts via the batched path.
- `../playground-sanitize` — `sanitizePlaygroundHtml` (DOMPurify).
- `node:fs/promises` — `readFile`, `stat`, `realpath` (realpath resolves symlinks before containment check).
