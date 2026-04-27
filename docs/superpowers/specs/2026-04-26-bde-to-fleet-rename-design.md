# BDE → FLEET Rename

**Date:** 2026-04-26  
**Status:** Approved

## Overview

Rename the product from "BDE" (Birkeland Development Environment) to "FLEET" (Agentic Development Environment) with full migration — no stale references left behind.

## Scope

- **In scope:** `~/projects/BDE` repo and `~/Users/ryan/CLAUDE.md`
- **Out of scope:** `bde-site`, `claude-task-runner`, `life-os`, `claude-chat-service`

## Substitution Map

| From | To |
|------|----|
| `BDE` | `FLEET` |
| `bde` | `fleet` |
| `Birkeland Development Environment` | `Agentic Development Environment` |
| `com.rbtechboy.bde` | `com.rbtechboy.fleet` |
| Path `~/projects/BDE` | `~/projects/FLEET` |

All case variants are covered: `BDE` → `FLEET`, `bde` → `fleet`. No partial renames (e.g., keeping `bde` in internal identifiers).

## What Changes

### Config Files
- `package.json`: `name`, `productName`, `description`
- `electron-builder.yml`: `appId`, `productName`, `copyright`, DMG title and app name

### Source Files (~20+ files)
- UI labels, window titles, toast messages, placeholder text
- Internal constants: `BDE_MEMORY_DIR` → `FLEET_MEMORY_DIR`, `BDE_DEFAULT_PERMISSIONS` → `FLEET_DEFAULT_PERMISSIONS`
- HTTP headers: `X-BDE-Delivery` → `X-FLEET-Delivery`, `X-BDE-Event` → `X-FLEET-Event`
- Hardcoded path strings referencing `/projects/BDE`

### Global CLAUDE.md
- All references to BDE project name, description, and path

### Directory Rename
- `~/projects/BDE` → `~/projects/FLEET` (after all file edits are complete)

## Approach

**Automated find-and-replace + directory rename:**

1. Run `grep -rl` to identify all affected files (excluding `node_modules`, `.git`, binary files)
2. Apply `sed` substitutions for each case variant
3. Rename the directory with `mv`
4. Update CLAUDE.md separately
5. Verify with a final `grep` sweep — zero remaining `BDE`/`bde`/`Birkeland Development Environment` references

## Success Criteria

- `grep -r "BDE\|bde\|Birkeland" ~/projects/FLEET --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.md"` returns zero results
- App builds and launches as "FLEET"
- CLAUDE.md reflects the new name and path throughout
