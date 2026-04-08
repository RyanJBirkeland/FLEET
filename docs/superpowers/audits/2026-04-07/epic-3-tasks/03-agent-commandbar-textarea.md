# Agents CommandBar: convert single-line input to auto-growing textarea

## Problem

`src/renderer/src/components/agents/CommandBar.tsx:207-221` uses `<input type="text">` for typing messages to a running agent. Single-line only. No Shift+Enter handling. Multi-line paste (stack traces, code snippets, error logs) collapses to one line and loses all newlines.

By contrast, `LaunchpadGrid.tsx:157` (the new-agent spawn prompt) uses `<textarea rows={2}>`, and the Code Review revise modal uses a proper multi-line input. Only the steady-state "talk to a running agent" surface is stuck on one line.

Bravo PM and Bravo Senior Dev both flagged this as MAJOR.

## Solution

Convert the `<input>` to an auto-growing `<textarea>` with these behaviors:

1. **Auto-grow** from 1 row up to a maximum of 6 rows. Use a `useLayoutEffect` that measures `scrollHeight` and sets `style.height`, or use the pattern already in LaunchpadGrid if there is one (prefer reuse — read `LaunchpadGrid.tsx:157` first).
2. **Enter** submits the message (same as the old input behavior).
3. **Shift+Enter** inserts a newline (default textarea behavior — you need to NOT preventDefault on Shift+Enter).
4. **Cmd+Enter** also submits (power-user fallback).
5. The placeholder stays the same or becomes clearer about multi-line support: `"Message the agent… (Shift+Enter for newline)"`.
6. Visual: the input should feel the same when empty (1 row) and expand smoothly as content grows.

If LaunchpadGrid's textarea has an auto-grow hook/util you can import, prefer reusing it over reimplementing.

## Files to Change

- `src/renderer/src/components/agents/CommandBar.tsx` — replace the `<input>` at ~line 207-221 and its keydown handler

## How to Test

1. `npm run typecheck` — 0 errors
2. `npm run test:coverage` — all tests pass
3. `npm run lint` — 0 errors
4. Run any CommandBar tests in isolation first to avoid parallel-load flakes.
5. `grep -n "input.*type=\"text\"" src/renderer/src/components/agents/CommandBar.tsx` — should return zero matches after the fix.

## Out of Scope

- Changing the message send logic itself
- Adding slash-command autocomplete (separate task)
- Touching LaunchpadGrid (unless extracting a shared hook)
- Adding file drop / attachment support
- Any CSS rework beyond what's needed for the textarea to look correct
