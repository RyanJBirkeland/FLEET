import { getSettingJson } from '../settings'
import { onSettingChanged, type SettingChangedEvent } from '../events/settings-events'
import type { RepoConfig } from '../paths'

/** Setting key holding the JSON-encoded list of configured repos. */
const REPOS_SETTING_KEY = 'repos'

export interface ReposCache {
  /** Return the current repos list, hitting the DB only when the cache is cold. */
  getRepos: () => RepoConfig[]
  /** Drop the in-memory value so the next `getRepos()` re-reads from settings. */
  invalidate: () => void
  /** Tear down the settings-changed subscription. Test-only cleanup hook. */
  dispose: () => void
}

export interface ReposCacheOptions {
  /** Override the settings reader — used in tests to avoid a live SQLite. */
  readRepos?: () => RepoConfig[] | null
  /** Override the event subscription — used in tests to fire synthetic changes. */
  subscribe?: (listener: (event: SettingChangedEvent) => void) => () => void
}

/**
 * Memoize the parsed `repos` setting so the hot `meta.repos` MCP tool
 * doesn't re-hit SQLite and JSON.parse on every call. The cache invalidates
 * the moment a user edits repos in Settings — `emitSettingChanged` fires
 * from the config handlers, so the next read reflects the new value
 * without a stale window.
 */
export function createReposCache(options: ReposCacheOptions = {}): ReposCache {
  const readRepos = options.readRepos ?? readReposFromSettings
  const subscribe = options.subscribe ?? onSettingChanged

  let cached: RepoConfig[] | null = null

  const unsubscribe = subscribe((event) => {
    if (event.key === REPOS_SETTING_KEY) cached = null
  })

  return {
    getRepos() {
      if (cached === null) cached = readRepos() ?? []
      return cached
    },
    invalidate() {
      cached = null
    },
    dispose() {
      unsubscribe()
      cached = null
    }
  }
}

function readReposFromSettings(): RepoConfig[] | null {
  return getSettingJson<RepoConfig[]>(REPOS_SETTING_KEY)
}
