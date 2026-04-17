/**
 * OAuth token validation for the drain loop.
 *
 * Thin wrapper around {@link getDefaultCredentialService} — returns a boolean
 * fit for a precondition check. The service owns the caching (5 min success,
 * 30 s failure) and proactive Keychain refresh; this file just adapts its
 * discriminated-return shape to the boolean the drain loop needs.
 *
 * The TTL constants stay exported for tests that assert cache windows — the
 * service uses the same values internally.
 */
import { getDefaultCredentialService } from '../services/credential-service'
import type { Logger } from '../logger'

export const OAUTH_CHECK_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
export const OAUTH_CHECK_FAIL_CACHE_TTL_MS = 30_000 // 30 seconds

export function invalidateCheckOAuthTokenCache(): void {
  // Delegated invalidation — drops the service's Claude cache entry.
  getDefaultCredentialService(console as unknown as Logger).invalidateCache('claude')
}

export async function checkOAuthToken(logger: Logger): Promise<boolean> {
  const service = getDefaultCredentialService(logger)
  const result = await service.getCredential('claude')
  if (result.status === 'ok') return true
  logger.warn(
    `[oauth-checker] Claude credential unavailable (${result.status}) — skipping drain. ${result.actionable ?? ''}`.trim()
  )
  return false
}
