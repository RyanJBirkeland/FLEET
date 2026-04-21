# schemas

**Layer:** main/mcp-server
**Source:** `src/main/mcp-server/schemas.ts`

## Purpose

Zod schemas for every MCP tool argument shape — tasks and epics. Each length-capped or constrained field carries a `.describe()` string so MCP clients (Claude Code, Claude Desktop, Cursor) discover the constraints from tool metadata, and so `toJsonRpcError` can surface the constraint text in validation failures.

## Public API

- `TaskStatusSchema`, `TaskDependencySchema`, `TaskWriteFieldsSchema`, `TaskCreateSchema`, `TaskUpdateSchema`, `TaskListSchema`, `TaskIdSchema`, `TaskCancelSchema`, `TaskHistorySchema`
- `EpicDependencySchema`, `EpicWriteFieldsSchema`, `EpicListSchema`, `EpicIdSchema`, `EpicUpdateSchema`, `EpicAddTaskSchema`, `EpicRemoveTaskSchema`, `EpicSetDependenciesSchema`

## Key Dependencies

- `zod` — schema definition + `.describe()` metadata used by `errors.ts::toJsonRpcError`
- `shared/task-state-machine` — `TASK_STATUSES` enum source of truth
