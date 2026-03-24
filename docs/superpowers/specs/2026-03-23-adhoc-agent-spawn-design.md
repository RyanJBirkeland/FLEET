# Ad-Hoc Agent Spawning via SpawnModal

**Date:** 2026-03-23
**Goal:** Fix the SpawnModal to spawn ad-hoc agent sessions (like running `claude` in a terminal with a GUI), independent of the sprint task queue.

---

## Problem

When the Embedded Agent Manager was built, the `local:spawnClaudeAgent` IPC handler was replaced with a throw: `"Use the Sprint board to queue tasks."` But the SpawnModal's purpose is ad-hoc agent sessions — not sprint tasks. The renderer-side code (SpawnModal → localAgents store → preload bridge) is intact and correct; only the main-process handler needs real implementation.

## Design

### Concept

The Agents view serves two purposes:
1. **Monitor sprint agents** — view, steer, and check on agents the Agent Manager spawned from the queue
2. **Ad-hoc agent sessions** — spawn a one-off agent directly via SpawnModal, like running `claude` in a terminal but with a GUI

Ad-hoc agents are not sprint tasks. They run on the repo's working directory (not a worktree), use the model selected in the SpawnModal, and persist to `agent_runs` + `agent_events` so they're visible in the Agents list and survive app restarts.

### Architecture

```
SpawnModal → localAgents.spawnAgent() → window.api.spawnLocalAgent()
  → preload: typedInvoke('local:spawnClaudeAgent', args)
    → agent-handlers.ts: spawnClaudeAgent handler
      → sdk-adapter.ts: spawnAgent({ prompt, cwd, model })
      → agent-history.ts: importAgent() → agent_runs table
      → consume handle.messages → broadcast 'agent:event' to renderer
                                → appendEvent() → agent_events table
      → return { id, pid, logPath, interactive }
```

### Changes

#### `src/main/handlers/agent-handlers.ts` — `local:spawnClaudeAgent` handler

Replace the throw (lines 32-36) with:

1. **Spawn the agent** via `spawnAgent()` from `sdk-adapter.ts`:
   - `prompt`: `args.task`
   - `cwd`: `args.repoPath` (the repo working directory — no worktree)
   - `model`: `args.model ?? 'claude-sonnet-4-5'`

2. **Record the run** via `importAgent()` from `agent-history.ts`:
   - `id`: new UUID
   - `task`: `args.task`
   - `repo`: derive from `repoPath` (basename or lookup)
   - `repoPath`: `args.repoPath`
   - `model`: selected model
   - `status`: `'running'`
   - `source`: `'adhoc'`

3. **Stream events** — consume `handle.messages` in the background (fire-and-forget async):
   - For each message, broadcast to renderer via `broadcast('agent:event', { agentId, event })`
   - Persist each event via `appendEvent()` to `agent_events` table for history
   - Map SDK messages to `AgentEvent` union types (agent:started, agent:text, agent:tool_use, agent:tool_result, agent:completed)

4. **Track completion** — when the message iterator ends:
   - Update `agent_runs` status to `'done'` (or `'error'` on exception)
   - Set `finishedAt` and `exitCode`

5. **Return immediately** with `SpawnLocalAgentResult`:
   - `id`: the agent run ID
   - `pid`: 0 (SDK doesn't expose PID; use 0 as sentinel)
   - `logPath`: path from agent-history
   - `interactive`: true (ad-hoc sessions support steering)

6. **Track active adhoc agents** — keep a `Map<string, AgentHandle>` in module scope so the existing `agent:steer` handler can steer ad-hoc agents too.

#### Message → AgentEvent mapping

The SDK adapter yields raw messages. Map them to `AgentEvent` types:

```typescript
// From shared/types.ts AgentEvent union:
// { type: 'agent:started', model, timestamp }
// { type: 'agent:text', text, timestamp }
// { type: 'agent:tool_use', name, input, timestamp }
// { type: 'agent:tool_result', output, timestamp }
// { type: 'agent:completed', exitCode, timestamp }
```

Messages from SDK/CLI are objects with varying shapes. Use best-effort mapping:
- Messages with `type: 'assistant'` and text content → `agent:text`
- Messages with `type: 'tool_use'` or `tool_name` → `agent:tool_use`
- Messages with `type: 'tool_result'` or `content` after tool_use → `agent:tool_result`
- First message → also emit `agent:started`
- Iterator end → emit `agent:completed`

#### `agent:steer` handler update

The existing `agent:steer` handler (line 42) already tries the Agent Manager first, then falls back to runner-client. Add a check for ad-hoc agents: if `agentId` is in the adhoc agents map, call `handle.steer(message)`.

### No changes needed

- **SpawnModal.tsx** — already collects task, repo, model; calls `localAgents.spawnAgent()`
- **localAgents.ts store** — `spawnAgent()` already calls `window.api.spawnLocalAgent()` and handles the response
- **Preload bridge** — `spawnLocalAgent` already bridges to `local:spawnClaudeAgent`
- **IPC channel types** — `SpawnLocalAgentArgs` and `SpawnLocalAgentResult` already match
- **agentEvents store** — already listens for `agent:event` broadcasts and renders them
- **AgentsView / AgentDetail** — already renders agent events from the store
- **Agent Manager** — unaffected, continues handling sprint task queue independently

### Persistence

- `agent_runs` table: recorded on spawn via `importAgent()`, updated on completion
- `agent_events` table: each event persisted via `appendEvent()`, retrievable via `agent:history` IPC for viewing historical sessions
- `source: 'adhoc'` distinguishes from Agent Manager runs (`source: 'embedded'`)

## Out of Scope

- Worktree creation for ad-hoc agents (agent can create its own if needed, like CLI)
- Changes to the sprint task flow
- Changes to the Agent Manager
- New IPC channels or types
