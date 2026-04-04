# Pipeline Pain Points — Live Observations (2026-04-03)

Documenting issues observed while running 30 tasks through the BDE pipeline in a single session.

## Pain Points Observed

### 1. Worktree eviction mid-task (ERROR)
**Task:** "Power User & Extensibility"
**Error:** "Worktree evicted before completion"
**Root cause:** macOS `/tmp` symlink issue — worktree created in `/tmp/worktrees/` which maps to `/private/tmp/` and files vanish between operations.
**Already documented in CLAUDE.md** but agents still hit it.
**Fix needed:** The agent-manager should NEVER create worktrees in `/tmp/`. The `DEFAULT_CONFIG.worktreeBase` defaults to `~/worktrees/bde` but something is overriding it.

### 2. Specs too large for single agent session
**Observation:** Plan files used as specs are 500-1500 lines. The full plan contains ALL tasks but each agent only needs ONE task. The agent receives the entire plan and must figure out which task to work on from the `notes` field hint.
**Impact:** Wasted context tokens. Agent confusion about scope.
**Fix needed:** Specs should be per-task, not per-plan. Or the notes field should contain the full task-specific spec and the plan should be a reference only.

### 3. No visibility into agent progress from CLI
**Observation:** Monitoring requires polling SQLite directly (`sqlite3 ~/.bde/bde.db "SELECT..."`) since the Queue API was removed. No CLI command for pipeline status.
**Impact:** Manual SQL queries are error-prone and tedious.
**Fix needed:** A `bde status` CLI command or re-expose a lightweight HTTP endpoint for pipeline monitoring.

### 4. Queue API removal left a monitoring gap
**Observation:** The Queue API on port 18790 was removed but nothing replaced its monitoring capabilities. SSE events, task listing, and status transitions were all available via HTTP. Now only SQLite + IPC remain.
**Impact:** External tools (scripts, other sessions) can't monitor or interact with the pipeline.

### 5. Task creation requires manual SQLite writes
**Observation:** Creating tasks from outside BDE now requires `sqlite3` INSERT statements. The Queue API POST endpoint is gone.
**Impact:** No programmatic task creation for automation, scripts, or external integrations.
**Note:** This directly contradicts the Power User audit finding about scriptability.

### 6. Blocked tasks with no clear unblock path
**Observation:** 2 tasks are in `blocked` status. The UI shows them but it's not immediately clear which dependency is blocking them or when they'll unblock.
**Impact:** Tasks can sit blocked indefinitely if their dependencies fail.

## Positive Observations

### 1. Agent manager drain loop works reliably
All 6 concurrent agent slots filled immediately after queuing. Tasks claimed correctly with WIP limit enforcement.

### 2. Retry with context working (from Plan G implementation)
The retry context injection we implemented earlier in this session is now being used by the agents — failed tasks get previous failure notes in their prompt.

### 3. Status transitions are clean
Tasks flow through `queued → active → review` correctly. Terminal service fires dependency resolution.

---

*This document will be updated as more tasks complete and more pain points are observed.*
