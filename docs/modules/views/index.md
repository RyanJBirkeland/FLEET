# Views

Top-level React view components. One per app view (Dashboard, IDE, Sprint Pipeline, etc.).
Source: `src/renderer/src/views/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `DashboardView.tsx` | Dashboard overview: status counters, pipeline flow, charts, activity feed. Polls dashboard data every 60s (`POLL_DASHBOARD_INTERVAL`) and load average every 5s (`POLL_LOAD_AVERAGE`). Both intervals start immediately on mount. | `DashboardView` (default) |
