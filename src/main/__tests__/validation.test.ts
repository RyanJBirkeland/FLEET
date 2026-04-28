import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../paths', () => ({
  getRepoPaths: vi.fn()
}))

import { validateRepoPath } from '../validation'
import { getRepoPaths } from '../paths'

describe('validateRepoPath', () => {
  beforeEach(() => {
    vi.mocked(getRepoPaths).mockReturnValue({ fleet: '/projects/fleet' })
  })

  it('accepts the exact repo root', () => {
    expect(validateRepoPath('/projects/fleet')).toBe('/projects/fleet')
  })

  it('accepts a valid child path', () => {
    expect(validateRepoPath('/projects/fleet/src/index.ts')).toBe(
      '/projects/fleet/src/index.ts'
    )
  })

  it('rejects a path outside the repo root', () => {
    expect(() => validateRepoPath('/etc/passwd')).toThrow('rejected')
  })

  it('rejects a prefix-match that is not a child (fleetother)', () => {
    expect(() => validateRepoPath('/projects/fleetother/file.ts')).toThrow('rejected')
  })

  it('rejects when no repos are configured', () => {
    vi.mocked(getRepoPaths).mockReturnValue({})
    expect(() => validateRepoPath('/projects/fleet/src/index.ts')).toThrow('rejected')
  })

  it('includes the custom label in the thrown error', () => {
    expect(() => validateRepoPath('/etc/passwd', 'File')).toThrow('File rejected')
  })

  it('resolves and rejects ../-traversal that escapes the root', () => {
    expect(() => validateRepoPath('/projects/fleet/../etc/passwd')).toThrow('rejected')
  })
})
