import { describe, it, expect } from 'vitest'
import { PIPELINE_DISALLOWED_TOOLS } from '../turn-budget'

describe('PIPELINE_DISALLOWED_TOOLS — recon entries', () => {
  it('blocks git log, status, ls-remote, diff, reflog', () => {
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(git log:*)')
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(git status:*)')
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(git ls-remote:*)')
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(git diff:*)')
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(git reflog:*)')
  })
})

describe('PIPELINE_DISALLOWED_TOOLS — network exfil entries', () => {
  it('blocks curl and wget Bash subcommands', () => {
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(curl:*)')
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(wget:*)')
  })

  it('blocks ssh, scp, and nc Bash subcommands', () => {
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(ssh:*)')
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(scp:*)')
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(nc:*)')
  })

  it('blocks the gh CLI', () => {
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('Bash(gh:*)')
  })

  it('blocks the WebFetch and WebSearch built-in tools', () => {
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('WebFetch')
    expect(PIPELINE_DISALLOWED_TOOLS).toContain('WebSearch')
  })
})
