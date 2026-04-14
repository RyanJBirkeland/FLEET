# Stores

Zustand state stores. One store per domain concern.
Source: `src/renderer/src/stores/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `sprintTasks.ts` | Primary sprint task store — CRUD, optimistic updates, polling merge. | `useSprintTasks`, `selectActiveTaskCount`, `selectReviewTaskCount`, `selectFailedTaskCount` |
