# Module Documentation Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `docs/modules/` documentation tree and wire the pre-commit gate into CLAUDE.md so all future agents maintain it automatically.

**Architecture:** Create a `docs/modules/` directory with a master TOC and eleven empty layer index files (headers only, no rows yet). Add a mandatory pre-commit instruction to CLAUDE.md. No code changes — this is purely docs scaffolding.

**Tech Stack:** Markdown, git

---

## Files

| Action | Path |
|--------|------|
| Create | `docs/modules/README.md` |
| Create | `docs/modules/services/index.md` |
| Create | `docs/modules/handlers/index.md` |
| Create | `docs/modules/data/index.md` |
| Create | `docs/modules/agent-manager/index.md` |
| Create | `docs/modules/components/index.md` |
| Create | `docs/modules/views/index.md` |
| Create | `docs/modules/stores/index.md` |
| Create | `docs/modules/hooks/index.md` |
| Create | `docs/modules/shared/index.md` |
| Create | `docs/modules/lib/main/index.md` |
| Create | `docs/modules/lib/renderer/index.md` |
| Modify | `CLAUDE.md` |

---

### Task 1: Create worktree

Work must happen in a worktree — never modify the main checkout directly.

- [ ] **Step 1: Create a worktree for this branch**

```bash
git worktree add -b chore/module-docs ~/worktrees/BDE/chore-module-docs main
cd ~/worktrees/BDE/chore-module-docs
```

Expected: new directory at `~/worktrees/BDE/chore-module-docs` on branch `chore/module-docs`.

---

### Task 2: Create master TOC

**Files:**
- Create: `docs/modules/README.md`

- [ ] **Step 1: Create the master TOC**

Create `docs/modules/README.md` with this exact content:

```markdown
# BDE Module Documentation

Codebase reference organized by architectural layer. Each layer index lists every module with its purpose and key exports. Modules with a detail file are linked.

| Layer | Description |
|-------|-------------|
| [Services](services/index.md) | Domain services — business logic that IPC handlers delegate to |
| [Handlers](handlers/index.md) | IPC handlers — thin wrappers over services |
| [Data](data/index.md) | Repository and query layer — SQLite access |
| [Agent Manager](agent-manager/index.md) | Pipeline agent lifecycle orchestration |
| [Components](components/index.md) | React UI components, grouped by domain |
| [Views](views/index.md) | Top-level view components (one per app view) |
| [Stores](stores/index.md) | Zustand state stores |
| [Hooks](hooks/index.md) | React hooks |
| [Shared](shared/index.md) | Types, IPC channels, constants shared across processes |
| [Lib — Main](lib/main/index.md) | Utility functions for the main process |
| [Lib — Renderer](lib/renderer/index.md) | Utility functions for the renderer process |

## How to use

- **Find a module:** go to its layer index, scan the Purpose column.
- **Add a module:** add a row to the layer index before committing. See CLAUDE.md § Module Documentation.
- **Add a detail file:** create `docs/modules/<layer>/<module>.md` and link it from the index row.
```

- [ ] **Step 2: Verify the file renders correctly**

Open `docs/modules/README.md` and confirm:
- Table has 11 rows
- All links follow the pattern `<layer>/index.md` or `lib/main/index.md` / `lib/renderer/index.md`
- Intro paragraph is present

- [ ] **Step 3: Commit**

```bash
git add docs/modules/README.md
git commit -m "chore: add docs/modules master TOC"
```

---

### Task 3: Create standard layer indexes

Nine layers with the standard three-column table (Module, Purpose, Key Exports).

**Files:**
- Create: `docs/modules/services/index.md`
- Create: `docs/modules/handlers/index.md`
- Create: `docs/modules/data/index.md`
- Create: `docs/modules/agent-manager/index.md`
- Create: `docs/modules/views/index.md`
- Create: `docs/modules/stores/index.md`
- Create: `docs/modules/hooks/index.md`
- Create: `docs/modules/shared/index.md`

- [ ] **Step 1: Create `docs/modules/services/index.md`**

```markdown
# Services

Business logic modules. IPC handlers delegate to these — they contain no business logic themselves.
Source: `src/main/services/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
```

- [ ] **Step 2: Create `docs/modules/handlers/index.md`**

```markdown
# Handlers

IPC handler modules. Thin wrappers — receive IPC calls, delegate to services, return results.
Source: `src/main/handlers/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
```

- [ ] **Step 3: Create `docs/modules/data/index.md`**

```markdown
# Data

Repository and query layer. All SQLite access lives here.
Source: `src/main/data/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
```

- [ ] **Step 4: Create `docs/modules/agent-manager/index.md`**

```markdown
# Agent Manager

Pipeline agent lifecycle orchestration — drain loop, worktree management, watchdog, completion handling.
Source: `src/main/agent-manager/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
```

- [ ] **Step 5: Create `docs/modules/views/index.md`**

```markdown
# Views

Top-level React view components. One per app view (Dashboard, IDE, Sprint Pipeline, etc.).
Source: `src/renderer/src/views/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
```

- [ ] **Step 6: Create `docs/modules/stores/index.md`**

```markdown
# Stores

Zustand state stores. One store per domain concern.
Source: `src/renderer/src/stores/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
```

- [ ] **Step 7: Create `docs/modules/hooks/index.md`**

```markdown
# Hooks

React hooks for shared logic across components.
Source: `src/renderer/src/hooks/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
```

- [ ] **Step 8: Create `docs/modules/shared/index.md`**

```markdown
# Shared

Types, IPC channel constants, and utilities shared across main and renderer processes.
Source: `src/shared/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
```

- [ ] **Step 9: Commit**

```bash
git add docs/modules/services/index.md \
        docs/modules/handlers/index.md \
        docs/modules/data/index.md \
        docs/modules/agent-manager/index.md \
        docs/modules/views/index.md \
        docs/modules/stores/index.md \
        docs/modules/hooks/index.md \
        docs/modules/shared/index.md
git commit -m "chore: add layer index stubs (services, handlers, data, agent-manager, views, stores, hooks, shared)"
```

---

### Task 4: Create components and lib indexes

These two layers have non-standard column sets.

**Files:**
- Create: `docs/modules/components/index.md`
- Create: `docs/modules/lib/main/index.md`
- Create: `docs/modules/lib/renderer/index.md`

- [ ] **Step 1: Create `docs/modules/components/index.md`**

Components uses a flat table with a `Group` column instead of subdirectories.

```markdown
# Components

React UI components, organized by domain group.
Source: `src/renderer/src/components/`

| Module | Group | Purpose | Key Exports |
|--------|-------|---------|-------------|
```

- [ ] **Step 2: Create `docs/modules/lib/main/index.md`**

```markdown
# Lib — Main

Utility functions and shared helpers for the main process.
Source: `src/main/lib/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
```

- [ ] **Step 3: Create `docs/modules/lib/renderer/index.md`**

```markdown
# Lib — Renderer

Utility functions and shared helpers for the renderer process.
Source: `src/renderer/src/lib/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
```

- [ ] **Step 4: Commit**

```bash
git add docs/modules/components/index.md \
        docs/modules/lib/main/index.md \
        docs/modules/lib/renderer/index.md
git commit -m "chore: add layer index stubs (components, lib/main, lib/renderer)"
```

---

### Task 5: Add CLAUDE.md pre-commit gate

**Files:**
- Modify: `CLAUDE.md`

The new section goes immediately after the existing `MANDATORY: Before EVERY commit` block (after the `Do NOT commit with failing checks...` line, before `## Pre-Push Hook`).

- [ ] **Step 1: Insert the module docs section into CLAUDE.md**

Find this block in `CLAUDE.md`:

```
Do NOT commit with failing checks. Fix issues first. If you cannot fix a failure, do NOT commit — report the issue.

## Pre-Push Hook
```

Replace it with:

```
Do NOT commit with failing checks. Fix issues first. If you cannot fix a failure, do NOT commit — report the issue.

## Module Documentation (MANDATORY pre-commit)

Before every commit, update `docs/modules/` for every source file you created or modified:

1. **Minimum:** ensure the module has a row in its layer `index.md`. Add one if missing.
2. **If you changed exports or observable behavior:** update or create the individual `<module>.md` detail file and link it from the index row.

**Layer → doc path:**

| If you touched... | Update... |
|---|---|
| `src/main/services/*` | `docs/modules/services/index.md` |
| `src/main/handlers/*` | `docs/modules/handlers/index.md` |
| `src/main/data/*` | `docs/modules/data/index.md` |
| `src/main/agent-manager/*` | `docs/modules/agent-manager/index.md` |
| `src/renderer/src/components/**` | `docs/modules/components/index.md` (Group column = component subdirectory name) |
| `src/renderer/src/views/*` | `docs/modules/views/index.md` |
| `src/renderer/src/stores/*` | `docs/modules/stores/index.md` |
| `src/renderer/src/hooks/*` | `docs/modules/hooks/index.md` |
| `src/shared/*` | `docs/modules/shared/index.md` |
| `src/main/lib/*` | `docs/modules/lib/main/index.md` |
| `src/renderer/src/lib/*` | `docs/modules/lib/renderer/index.md` |

**Module detail file template** (create at `docs/modules/<layer>/<module>.md`):

```markdown
# <module-name>

**Layer:** <layer>
**Source:** `<relative-path-from-repo-root>`

## Purpose
One or two sentences.

## Public API
- `exportedThing` — what it does
(For React components: list the default export + any named types/hooks/sub-components)

## Key Dependencies
- `dependency.ts` — why it's used
```

Omit implementation details, private functions, and anything already clear from source comments. Keep it to what a caller needs to know. **File renamed?** Update the index row. **File deleted?** Remove the index row.

## Pre-Push Hook
```

- [ ] **Step 2: Verify the section is in the right place**

Open `CLAUDE.md` and confirm:
- The new `## Module Documentation (MANDATORY pre-commit)` section appears between `Do NOT commit with failing checks...` and `## Pre-Push Hook`
- The mapping table has 11 rows
- The template block is present and correctly formatted

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: add module documentation pre-commit gate to CLAUDE.md"
```

---

### Task 6: Open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin chore/module-docs
```

- [ ] **Step 2: Create PR**

```bash
gh pr create \
  --title "chore: bootstrap docs/modules documentation tree" \
  --body "Bootstraps the module documentation system defined in docs/superpowers/specs/2026-04-13-codebase-module-docs-design.md.

## What this adds
- \`docs/modules/README.md\` — master TOC linking all 11 layer indexes
- 11 layer index stubs (empty tables, headers only): services, handlers, data, agent-manager, components, views, stores, hooks, shared, lib/main, lib/renderer
- CLAUDE.md pre-commit gate: agents must add/update a module row before every commit

## What this doesn't do
No backfill of existing modules. The tree grows organically as agents touch files going forward.
"
```

- [ ] **Step 3: Clean up worktree after merge**

After the PR is merged:

```bash
git worktree remove ~/worktrees/BDE/chore-module-docs
```
