import { describe, it, expect } from 'vitest'
import { detectNoOpRun } from '../noop-detection'

describe('detectNoOpRun', () => {
  it('does NOT treat an empty change list as a no-op (defers to hasCommitsAheadOfMain)', () => {
    expect(detectNoOpRun([], '/tmp/worktree')).toBe(false)
  })

  it('treats Aider scratch files as no-op markers', () => {
    expect(
      detectNoOpRun(
        ['.aider.chat.history.md', '.aider.input.history', '.aider.tags.cache.v4/file.json'],
        '/tmp/worktree'
      )
    ).toBe(true)
  })

  it('treats a .gitignore of only Aider patterns as a no-op', () => {
    const readFile = () => '.aider*\n'
    expect(detectNoOpRun(['.gitignore'], '/tmp/worktree', { readFile })).toBe(true)
  })

  it('tolerates comments and blank lines in the .gitignore', () => {
    const readFile = () => '# aider scratch\n\n.aider*\n'
    expect(detectNoOpRun(['.gitignore'], '/tmp/worktree', { readFile })).toBe(true)
  })

  it('does NOT treat a .gitignore with real patterns as a no-op', () => {
    const readFile = () => '.aider*\nnode_modules/\n'
    expect(detectNoOpRun(['.gitignore'], '/tmp/worktree', { readFile })).toBe(false)
  })

  it('does NOT treat a real source file change as a no-op', () => {
    expect(detectNoOpRun(['greet.py', '.aider.input.history'], '/tmp/worktree')).toBe(false)
  })

  it('returns false when the gitignore cannot be read', () => {
    const readFile = () => {
      throw new Error('ENOENT')
    }
    expect(detectNoOpRun(['.gitignore'], '/tmp/worktree', { readFile })).toBe(false)
  })

  it('does NOT treat an empty .gitignore as a no-op (no Aider patterns means not an Aider scratch)', () => {
    const readFile = () => '\n\n# empty\n'
    expect(detectNoOpRun(['.gitignore'], '/tmp/worktree', { readFile })).toBe(false)
  })
})
