#!/usr/bin/env python3
"""Queue all Agents View Redesign tasks into BDE's SQLite sprint_tasks table.

Handles task dependencies via depends_on field (JSON array of {id, type} pairs).
Insertion order matters because dependencies reference earlier task IDs.
"""

import json
import os
import sqlite3
import sys
from pathlib import Path

DB_PATH = os.path.expanduser("~/.bde/bde.db")
TASK_DIR = Path(__file__).parent

# Order matters — tasks with dependencies must be inserted AFTER their parents.
# Each tuple: (filename, title, spec_type, depends_on_keys)
# depends_on_keys are filename keys; resolved to actual inserted IDs at queue time.
TASKS = [
    # Wave 1 — independent
    (
        "01-inline-styles-cleanup.md",
        "Agents View Redesign 01: Inline-styles cleanup (AgentsView + AgentList)",
        "refactor",
        [],
    ),
    (
        "03-cockpit-header-growth.md",
        "Agents View Redesign 03: Cockpit header growth + typography",
        "feature",
        [],
    ),
    (
        "04-console-body-file-restructure.md",
        "Agents View Redesign 04: Console body file restructure (no visual change)",
        "refactor",
        [],
    ),
    # Wave 2 — depend on Wave 1
    (
        "02-sidebar-card-redesign.md",
        "Agents View Redesign 02: Sidebar card redesign + panel resize",
        "feature",
        ["01-inline-styles-cleanup.md"],
    ),
    (
        "07-fleet-at-a-glance-empty-state.md",
        "Agents View Redesign 07: Fleet at a Glance empty state",
        "feature",
        ["01-inline-styles-cleanup.md"],
    ),
    (
        "05-card-grammar-conversation.md",
        "Agents View Redesign 05: Card grammar — conversation cards",
        "feature",
        ["04-console-body-file-restructure.md"],
    ),
    # Wave 3 — depends on Wave 2
    (
        "06-card-grammar-tool-cards-edit-diff.md",
        "Agents View Redesign 06: Card grammar — tool cards + EditDiffCard",
        "feature",
        ["05-card-grammar-conversation.md"],
    ),
]


def main() -> int:
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Verify schema
    cur.execute("PRAGMA table_info(sprint_tasks)")
    cols = {row[1] for row in cur.fetchall()}
    required = {"title", "status", "repo", "spec", "spec_type", "priority", "depends_on"}
    missing = required - cols
    if missing:
        print(f"ERROR: sprint_tasks missing columns: {missing}", file=sys.stderr)
        conn.close()
        return 1

    # Map filename → inserted task id (for resolving dependencies)
    inserted_ids: dict[str, str] = {}
    queued = 0
    skipped = 0

    for filename, title, spec_type, deps_keys in TASKS:
        spec_path = TASK_DIR / filename
        if not spec_path.exists():
            print(f"SKIP: {filename} not found")
            skipped += 1
            continue

        # Skip if a task with this title already exists (idempotent re-runs)
        cur.execute("SELECT id FROM sprint_tasks WHERE title = ?", (title,))
        existing = cur.fetchone()
        if existing:
            print(f"SKIP: '{title}' already exists (id={existing[0]})")
            inserted_ids[filename] = existing[0]
            skipped += 1
            continue

        spec = spec_path.read_text()

        # Resolve dependencies — every dep must already be in inserted_ids
        deps_payload = []
        for dep_key in deps_keys:
            if dep_key not in inserted_ids:
                print(
                    f"ERROR: {filename} depends on {dep_key} but that task hasn't been inserted yet. "
                    f"Check TASKS ordering.",
                    file=sys.stderr,
                )
                conn.rollback()
                conn.close()
                return 1
            deps_payload.append({"id": inserted_ids[dep_key], "type": "hard"})

        depends_on_json = json.dumps(deps_payload) if deps_payload else None

        # Insert
        sql = """
            INSERT INTO sprint_tasks (
                title, status, repo, spec, spec_type, priority,
                needs_review, playground_enabled, depends_on
            )
            VALUES (?, 'queued', 'bde', ?, ?, 1, 1, 0, ?)
        """
        cur.execute(sql, (title, spec, spec_type, depends_on_json))
        new_id = cur.lastrowid
        # sprint_tasks.id may be a string TEXT column — fetch the actual id
        cur.execute("SELECT id FROM sprint_tasks WHERE rowid = ?", (new_id,))
        row = cur.fetchone()
        actual_id = row[0] if row else str(new_id)
        inserted_ids[filename] = actual_id

        dep_summary = (
            f" (depends on {len(deps_keys)} task{'s' if len(deps_keys) != 1 else ''})"
            if deps_keys
            else ""
        )
        print(f"QUEUED: {title}{dep_summary}")
        queued += 1

    conn.commit()
    conn.close()

    print(f"\nDone. {queued} tasks queued, {skipped} skipped.")
    if queued > 0:
        print(
            "\nThe BDE drain loop should pick up the independent tasks (01, 03, 04) "
            "within ~30s. Dependent tasks will auto-unblock as their parents succeed."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
