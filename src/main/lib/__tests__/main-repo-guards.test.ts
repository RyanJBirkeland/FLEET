import { describe, it, expect } from 'vitest'
import { isRepoDirtyForGuard } from '../main-repo-guards'

describe('main-repo-guard: docs-only escape', () => {
  it('returns false when every dirty path is docs/**/*.md', () => {
    expect(
      isRepoDirtyForGuard(
        ` M docs/superpowers/audits/2026-04-20/pipeline-notes.md\n?? docs/new-note.md\n`
      )
    ).toBe(false)
  })

  it('returns true when any non-docs file is dirty', () => {
    expect(isRepoDirtyForGuard(` M src/main/index.ts\n M docs/x.md\n`)).toBe(true)
  })

  it('returns true when a docs file is non-markdown (images, html, etc.)', () => {
    expect(isRepoDirtyForGuard(`?? docs/screenshots/new.png\n`)).toBe(true)
  })

  it('returns true for docs/* that is not .md (binary)', () => {
    expect(isRepoDirtyForGuard(`?? docs/tmp.bin\n`)).toBe(true)
  })

  it('returns false for empty porcelain output (clean repo)', () => {
    expect(isRepoDirtyForGuard('')).toBe(false)
  })
})
