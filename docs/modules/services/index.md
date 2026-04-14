# Services

Business logic modules. IPC handlers delegate to these — they contain no business logic themselves.
Source: `src/main/services/`

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `repo-search-service.ts` | Grep-based codebase search for workbench research — literal fixed-string search to prevent ReDoS | `searchRepo`, `parseGrepOutput`, `RepoSearchResult`, `RepoSearchMatch` |
