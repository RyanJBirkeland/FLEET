# Hooks

React hooks for shared logic across components.
Source: `src/renderer/src/hooks/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `useFilteredTasks.ts` | Derives filtered and partitioned task subsets from sprint store + UI filter state. Uses `useShallow` to prevent re-renders when task array contents are unchanged. | `useFilteredTasks` |
