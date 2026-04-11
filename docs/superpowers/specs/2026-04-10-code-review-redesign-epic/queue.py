#!/usr/bin/env python3
"""
Queue the Code Review redesign epic into the local BDE sprint_tasks table.

Four tasks are queued with hard dependency edges:

  T1 (queued) ◀─hard─ T2 (blocked) ◀─hard─ T3 (blocked) ◀─hard─ T4 (blocked)

T1 starts immediately. T2/T3/T4 unblock only when their predecessor reaches
`done` status (HARD_SATISFIED_STATUSES in src/shared/task-transitions.ts), i.e.
after the user ships the upstream task via the Code Review Station.

IDs are deterministic hashes of a fixed slug, so re-running this script is a
no-op. To re-queue from scratch, delete the four rows first:

    sqlite3 ~/.bde/bde.db \\
      "DELETE FROM sprint_tasks WHERE title LIKE 'CR Redesign %'"

Usage:
    python3 docs/superpowers/specs/2026-04-10-code-review-redesign-epic/queue.py
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
from pathlib import Path

DB_PATH = Path.home() / ".bde" / "bde.db"
EPIC_DIR = Path(__file__).parent

# Each entry: (slug, spec_filename, title). Order matters — the script chains
# dependencies from first → last. The slug is hashed to produce a deterministic
# 32-char hex task id.
TASKS = [
    (
        "cr-redesign-01-filetree-extraction",
        "task-01-filetree-extraction.md",
        "CR Redesign 01: Extract FileTreePanel + hoist selectedDiffFile",
    ),
    (
        "cr-redesign-02-shell-topbar",
        "task-02-shell-topbar.md",
        "CR Redesign 02: Three-column shell + TopBar",
    ),
    (
        "cr-redesign-03-ai-assistant-scaffold",
        "task-03-ai-assistant-scaffold.md",
        "CR Redesign 03: AIAssistantPanel visual scaffolding",
    ),
    (
        "cr-redesign-04-batch-responsive-polish",
        "task-04-batch-responsive-polish.md",
        "CR Redesign 04: Batch mode + responsive rails + token sweep",
    ),
]


def slug_to_id(slug: str) -> str:
    """Deterministic 32-char hex id — matches the schema's randomblob format."""
    return hashlib.sha256(f"bde-epic:{slug}".encode()).hexdigest()[:32]


def read_spec(filename: str) -> str:
    path = EPIC_DIR / filename
    if not path.exists():
        raise SystemExit(f"Missing spec file: {path}")
    return path.read_text()


def task_exists(cur: sqlite3.Cursor, task_id: str) -> bool:
    cur.execute("SELECT 1 FROM sprint_tasks WHERE id = ?", (task_id,))
    return cur.fetchone() is not None


def insert_task(
    cur: sqlite3.Cursor,
    task_id: str,
    title: str,
    spec: str,
    status: str,
    depends_on: list[dict] | None,
) -> None:
    cur.execute(
        """
        INSERT INTO sprint_tasks (
            id, title, prompt, repo, status, priority, spec, spec_type,
            needs_review, playground_enabled, depends_on
        ) VALUES (?, ?, '', 'bde', ?, 1, ?, 'feature', 1, 0, ?)
        """,
        (
            task_id,
            title,
            status,
            spec,
            json.dumps(depends_on) if depends_on else None,
        ),
    )


def main() -> int:
    if not DB_PATH.exists():
        print(f"Error: BDE database not found at {DB_PATH}", file=sys.stderr)
        return 1

    ids = [slug_to_id(slug) for slug, _, _ in TASKS]

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        cur = conn.cursor()

        for i, (slug, filename, title) in enumerate(TASKS):
            task_id = ids[i]
            if task_exists(cur, task_id):
                print(f"  [skip] {title[:60]} — already queued (id={task_id[:8]}…)")
                continue

            spec = read_spec(filename)
            if i == 0:
                status = "queued"
                depends_on = None
            else:
                status = "blocked"
                depends_on = [{"id": ids[i - 1], "type": "hard"}]

            insert_task(cur, task_id, title, spec, status, depends_on)
            dep_label = "—" if depends_on is None else depends_on[0]["id"][:8] + "…"
            print(f"  [+]    {title[:60]}")
            print(f"         id={task_id}  status={status}  depends_on={dep_label}")

        conn.commit()
    finally:
        conn.close()

    print()
    print("Epic queued. Monitor in:")
    print("  • BDE Task Pipeline (⌘4)")
    print("  • Code Review Station (⌘5) after each task reaches `review`")
    print()
    print("Next: the drain loop picks up T1 within 30s.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
