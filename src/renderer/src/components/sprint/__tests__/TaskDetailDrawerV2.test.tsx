import { describe, it, expect } from 'vitest'
import {
  BRANCH_PUSHED_PATTERN,
  GH_REPO_PATTERN,
  GH_BRANCH_PATTERN,
  buildBranchOnlyPrLink
} from '../branch-pr-link'

/**
 * Tests for the BRANCH_PUSHED_PATTERN group-capture injection-prevention invariant.
 *
 * Security invariant: the pattern extracts exactly two groups — the branch name
 * and the repo slug — via regex captures. Any text appearing after the repo slug
 * (e.g. injected tokens like "extra-garbage") is NOT captured and therefore
 * cannot influence the constructed URL. Only the two captured groups are used,
 * and each is independently validated by GH_BRANCH_PATTERN / GH_REPO_PATTERN
 * before being passed to encodeURIComponent.
 */
describe('BRANCH_PUSHED_PATTERN injection prevention', () => {
  it('extracts branch and repo from a well-formed notes string', () => {
    const notes = 'Branch agent/my-feature pushed to owner/repo'
    const match = notes.match(BRANCH_PUSHED_PATTERN)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('agent/my-feature')
    expect(match![2]).toBe('owner/repo')
  })

  it('ignores trailing garbage tokens after the repo slug', () => {
    // An attacker might try to add trailing tokens hoping they reach the URL.
    // The group capture stops at the second \S+ match — extra tokens are ignored.
    const notes = 'Branch agent/foo pushed to owner/repo extra-garbage'
    const match = notes.match(BRANCH_PUSHED_PATTERN)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('agent/foo')
    expect(match![2]).toBe('owner/repo')
  })

  it('produces a correct URL from a notes value with trailing garbage tokens', () => {
    const notes = 'Branch agent/foo pushed to owner/repo extra-garbage'
    const link = buildBranchOnlyPrLink(notes)
    // The link should be an anchor element (React node) — not null
    expect(link).not.toBeNull()
    // Cast to check href value via React element props
    const element = link as React.ReactElement<{ href: string }>
    expect(element.props.href).toBe(
      'https://github.com/owner%2Frepo/pull/new/agent%2Ffoo'
    )
  })

  it('returns null when the notes string has no matching branch-push pattern', () => {
    expect(buildBranchOnlyPrLink('No branch info here')).toBeNull()
    expect(buildBranchOnlyPrLink(null)).toBeNull()
    expect(buildBranchOnlyPrLink(undefined)).toBeNull()
  })

  it('rejects a branch containing shell-injection characters', () => {
    // GH_BRANCH_PATTERN only allows [a-zA-Z0-9/_.-] — spaces, semicolons, and
    // backticks are blocked, preventing shell-injection in branch names.
    expect(GH_BRANCH_PATTERN.test('agent/foo; rm -rf /')).toBe(false)
    expect(GH_BRANCH_PATTERN.test('agent/foo`echo`')).toBe(false)
    expect(GH_BRANCH_PATTERN.test('agent/valid-branch')).toBe(true)
    // Dot-dot sequences are allowed by the pattern — but safe because the full
    // branch value is passed through encodeURIComponent before URL construction.
    expect(GH_BRANCH_PATTERN.test('../traversal')).toBe(true)
  })

  it('rejects a repo slug with spaces or shell metacharacters', () => {
    // GH_REPO_PATTERN only allows [a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+
    expect(GH_REPO_PATTERN.test('owner/repo; rm -rf /')).toBe(false)
    expect(GH_REPO_PATTERN.test('owner/repo extra')).toBe(false)
    expect(GH_REPO_PATTERN.test('owner/valid-repo')).toBe(true)
  })
})
