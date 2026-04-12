/**
 * Tests for extracted pure functions from index.ts:
 * - checkOAuthToken: OAuth token file validation
 * - taskStatusMap refresh after claim (F-t1-perf-snapshot)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return { ...actual, readFile: vi.fn(), stat: vi.fn() }
})

vi.mock('../../env-utils', () => ({
  refreshOAuthTokenFromKeychain: vi.fn(),
  invalidateOAuthToken: vi.fn()
}))

import { readFile, stat } from 'node:fs/promises'
import {
  checkOAuthToken,
  invalidateCheckOAuthTokenCache,
  OAUTH_CHECK_CACHE_TTL_MS,
  OAUTH_CHECK_FAIL_CACHE_TTL_MS
} from '../oauth-checker'
import { refreshOAuthTokenFromKeychain, invalidateOAuthToken } from '../../env-utils'

const readFileMock = vi.mocked(readFile)
const statMock = vi.mocked(stat)

function makeLogger(): Logger & {
  info: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
} {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

describe('checkOAuthToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCheckOAuthTokenCache()
    // Default: token file is recent (1 minute old) — no age-based refresh
    statMock.mockResolvedValue({ mtimeMs: Date.now() - 60_000 } as Awaited<ReturnType<typeof stat>>)
  })

  it('returns true when token file has valid content (>= 20 chars)', async () => {
    readFileMock.mockResolvedValue('a-valid-oauth-token-that-is-long-enough')
    const logger = makeLogger()
    expect(await checkOAuthToken(logger)).toBe(true)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('returns false and logs warning when token file cannot be read', async () => {
    readFileMock.mockRejectedValue(new Error('ENOENT'))
    const logger = makeLogger()
    expect(await checkOAuthToken(logger)).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Cannot read OAuth token file')
    )
  })

  it('attempts keychain refresh when token is too short and succeeds', async () => {
    readFileMock.mockResolvedValue('short')
    vi.mocked(refreshOAuthTokenFromKeychain).mockResolvedValue(true)
    const logger = makeLogger()
    expect(await checkOAuthToken(logger)).toBe(true)
    expect(refreshOAuthTokenFromKeychain).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('OAuth token auto-refreshed'))
  })

  it('returns false when token is too short and keychain refresh fails', async () => {
    readFileMock.mockResolvedValue('short')
    vi.mocked(refreshOAuthTokenFromKeychain).mockResolvedValue(false)
    const logger = makeLogger()
    expect(await checkOAuthToken(logger)).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('keychain refresh failed'))
  })

  it('returns false when token file is empty', async () => {
    readFileMock.mockResolvedValue('')
    vi.mocked(refreshOAuthTokenFromKeychain).mockResolvedValue(false)
    expect(await checkOAuthToken(makeLogger())).toBe(false)
  })

  it('trims whitespace from token before checking length', async () => {
    readFileMock.mockResolvedValue('                    ')
    vi.mocked(refreshOAuthTokenFromKeychain).mockResolvedValue(false)
    expect(await checkOAuthToken(makeLogger())).toBe(false)
  })

  it('proactively refreshes when token file is older than 45 minutes', async () => {
    readFileMock.mockResolvedValue('a-valid-oauth-token-that-is-long-enough')
    statMock.mockResolvedValue({ mtimeMs: Date.now() - 46 * 60_000 } as Awaited<
      ReturnType<typeof stat>
    >)
    vi.mocked(refreshOAuthTokenFromKeychain).mockResolvedValue(true)
    const logger = makeLogger()
    expect(await checkOAuthToken(logger)).toBe(true)
    expect(refreshOAuthTokenFromKeychain).toHaveBeenCalled()
    expect(invalidateOAuthToken).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('proactively refreshed'))
  })

  it('does not proactively refresh when token file is recent (< 45 minutes)', async () => {
    readFileMock.mockResolvedValue('a-valid-oauth-token-that-is-long-enough')
    statMock.mockResolvedValue({ mtimeMs: Date.now() - 10 * 60_000 } as Awaited<
      ReturnType<typeof stat>
    >)
    const logger = makeLogger()
    expect(await checkOAuthToken(logger)).toBe(true)
    expect(refreshOAuthTokenFromKeychain).not.toHaveBeenCalled()
  })

  it('continues with existing token when stat fails during age check', async () => {
    readFileMock.mockResolvedValue('a-valid-oauth-token-that-is-long-enough')
    statMock.mockRejectedValue(new Error('stat failed'))
    const logger = makeLogger()
    expect(await checkOAuthToken(logger)).toBe(true)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('reads token file only once when called N times within TTL (F-t1-sysprof-5)', async () => {
    readFileMock.mockResolvedValue('a-valid-oauth-token-that-is-long-enough')

    for (let i = 0; i < 10; i++) {
      expect(await checkOAuthToken(makeLogger())).toBe(true)
    }

    // Only the first call should have hit the filesystem
    expect(readFileMock).toHaveBeenCalledTimes(1)
  })

  it('re-checks after success TTL expires (F-t1-sysprof-5)', async () => {
    vi.useFakeTimers()
    try {
      readFileMock.mockResolvedValue('a-valid-oauth-token-that-is-long-enough')
      await checkOAuthToken(makeLogger())
      expect(readFileMock).toHaveBeenCalledTimes(1)

      // Advance past the success TTL
      vi.advanceTimersByTime(OAUTH_CHECK_CACHE_TTL_MS + 1)

      await checkOAuthToken(makeLogger())
      expect(readFileMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-checks after failure TTL expires (F-t1-sysprof-5)', async () => {
    vi.useFakeTimers()
    try {
      readFileMock.mockRejectedValue(new Error('ENOENT'))
      await checkOAuthToken(makeLogger())
      expect(readFileMock).toHaveBeenCalledTimes(1)

      // Advance past the failure TTL (shorter: 30s)
      vi.advanceTimersByTime(OAUTH_CHECK_FAIL_CACHE_TTL_MS + 1)

      await checkOAuthToken(makeLogger())
      expect(readFileMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
