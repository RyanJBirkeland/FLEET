import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs')
  return { ...actual, readFileSync: vi.fn(), existsSync: vi.fn() }
})

import { getOAuthToken, invalidateOAuthToken } from '../env-utils'
import { readFileSync, existsSync } from 'node:fs'

describe('OAuth token cache', () => {
  beforeEach(() => {
    invalidateOAuthToken()
    vi.mocked(existsSync).mockReturnValue(true)
  })

  it('invalidateOAuthToken forces next call to re-read from disk', () => {
    vi.mocked(readFileSync).mockReturnValue('token-v1')
    const t1 = getOAuthToken()
    expect(t1).toBe('token-v1')

    vi.mocked(readFileSync).mockReturnValue('token-v2')
    expect(getOAuthToken()).toBe('token-v1') // still cached

    invalidateOAuthToken()
    expect(getOAuthToken()).toBe('token-v2') // re-read
  })
})
