# paths.ts

**Layer:** Main process — Lib
**Source:** `src/main/paths.ts`

## Purpose

Centralized FLEET data-directory paths and repo configuration helpers. Enforces security constraints (worktree base must be in home directory, test DB must be in /tmp) and provides case-insensitive lookups for configured repos.

## Public API

### Constants
- `FLEET_DIR` — FLEET user data directory, defaults to `~/.fleet` (overridable via `FLEET_DATA_DIR` env var)
- `FLEET_DB_PATH` — SQLite database path (overridable via `FLEET_DB_PATH` or `FLEET_TEST_DB` env var)
- `FLEET_AGENTS_INDEX` — Agents JSON index path under `FLEET_DIR`
- `FLEET_MEMORY_DIR` — Local memory directory under `FLEET_DIR`
- `FLEET_TASK_MEMORY_DIR` — Per-task memory subdir under `FLEET_MEMORY_DIR`
- `DEFAULT_PIPELINE_WORKTREE_BASE` — Default pipeline worktree root (`~/.fleet/worktrees`)
- `ADHOC_WORKTREE_BASE` — Adhoc agent worktree root (`~/.fleet/worktrees-adhoc`), shared by adhoc agents and review handlers

### Types
- `RepoConfig` — Repository settings including `name`, `localPath`, optional `githubOwner`, `githubRepo`, `color`, `promptProfile` (`'fleet'` | `'minimal'`), and per-repo `envVars` (environment variables injected into pipeline agent spawns)

### Functions
- `validateWorktreeBase(path: string)` — Throws if path is not inside home directory (security constraint)
- `validateTestDbPath(path: string | undefined)` — Throws if path is not in system temp or `:memory:` (security constraint)
- `getConfiguredRepos()` → `RepoConfig[]` — All configured repos from settings
- `getRepoConfig(name: string)` → `RepoConfig | null` — Look up a repo by name (case-insensitive)
- `getRepoPath(name: string)` → `string | undefined` — Look up a repo's local path (case-insensitive, prefer over `getRepoPaths()[name]`)
- `getRepoPaths()` → `Record<string, string>` — Map of all repo names (lowercase keys) to paths
- `getRepoPromptProfile(repoName: string | null | undefined)` → `'fleet' | 'minimal'` — Repo's prompt profile, defaults to `'fleet'`
- `getRepoEnvVars(repoSlug: string | null | undefined)` → `Record<string, string>` — Per-repo env vars, returns `{}` if not configured
- `getGhRepo(repoSlug: string)` → `string | null` — GitHub `owner/repo` format for a repo
- `getSpecsRoot()` → `string | null` — Path to the primary repo's `docs/specs/` directory

## Key Dependencies

- `src/main/settings.ts` — `getSettingJson` retrieves repo config from SQLite
- `fs` / `path` — Path resolution and validation

## Notes

- **Case-insensitivity:** All repo lookups are case-insensitive — queries normalize to lowercase internally
- **Env vars:** Per-repo `envVars` are stored in plaintext in the SQLite settings table. Used by `buildAgentEnv` in `src/main/lib/env-utils.ts` to inject custom environment variables into pipeline agent spawn calls
- **Security:** Both `validateWorktreeBase` and `validateTestDbPath` are exported for testing and are called at module load time to validate env-var overrides before constants are used
