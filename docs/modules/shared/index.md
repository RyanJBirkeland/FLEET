# Shared

Types, IPC channel constants, and utilities shared across main and renderer processes.
Source: `src/shared/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `task-statuses.ts` | Single source of truth for task status constants, predicates, and UI metadata. Re-exports everything from `task-state-machine.ts` plus `ALL_TASK_STATUSES`, `STATUS_METADATA`, `BucketKey`, and `StatusMetadata`. | `ALL_TASK_STATUSES`, `TaskStatus`, `TERMINAL_STATUSES`, `FAILURE_STATUSES`, `STATUS_METADATA`, `BucketKey`, `isTerminal`, `isFailure` |
