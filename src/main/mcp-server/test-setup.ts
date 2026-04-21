import { setSettingJson } from '../settings'
import type { RepoConfig } from '../paths'

/**
 * Seeds a test bde repo config so integration tests don't silently skip.
 * Call from beforeAll in integration test files.
 *
 * @param localPath - Path used as the repo's `localPath` in settings.
 *   Defaults to `process.cwd()` for backward compat; callers running from a
 *   non-repo cwd should pass the real repo root.
 */
export function seedBdeRepo(localPath: string = process.cwd()): void {
  setSettingJson<RepoConfig[]>('repos', [
    {
      name: 'bde',
      localPath,
      githubOwner: 'test',
      githubRepo: 'bde',
      color: '#00ff88'
    }
  ])
}
