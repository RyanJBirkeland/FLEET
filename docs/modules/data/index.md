# Data

Repository and query layer. All SQLite access lives here.
Source: `src/main/data/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| [sprint-pr-ops](sprint-pr-ops.md) | PR lifecycle queries — mark done/cancelled, update mergeable state, list open PRs | `markTaskDoneByPrNumber`, `markTaskCancelledByPrNumber`, `updateTaskMergeableState`, `listTasksWithOpenPrs` |
