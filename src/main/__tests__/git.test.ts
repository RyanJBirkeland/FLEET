import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execSync, execFileSync, spawnSync } from 'child_process'
import {
  gitCommit,
  gitCheckout,
  gitStage,
  gitUnstage,
  gitPush,
  gitStatus,
  gitBranches,
  gitDiffFile,
  getRepoPaths,
} from '../git'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
  spawnSync: vi.fn(),
}))

describe('git.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('gitCommit', () => {
    it('calls execFileSync with commit args', () => {
      gitCommit('/tmp/repo', 'fix: something')

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'fix: something'],
        { cwd: '/tmp/repo', encoding: 'utf-8' }
      )
    })

    it('passes special characters safely via execFileSync', () => {
      gitCommit('/tmp/repo', 'fix: use "proper" quotes')

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'fix: use "proper" quotes'],
        { cwd: '/tmp/repo', encoding: 'utf-8' }
      )
    })
  })

  describe('gitCheckout', () => {
    it('calls execFileSync with checkout args', () => {
      gitCheckout('/tmp/repo', 'feat/new-branch')

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['checkout', 'feat/new-branch'],
        { cwd: '/tmp/repo', encoding: 'utf-8' }
      )
    })

    it('passes branch names with special characters safely', () => {
      gitCheckout('/tmp/repo', 'branch"name')

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['checkout', 'branch"name'],
        { cwd: '/tmp/repo', encoding: 'utf-8' }
      )
    })
  })

  describe('gitStage', () => {
    it('calls execFileSync with git add and file paths', () => {
      gitStage('/tmp/repo', ['file1.ts', 'src/file2.ts'])

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['add', '--', 'file1.ts', 'src/file2.ts'],
        { cwd: '/tmp/repo', encoding: 'utf-8' }
      )
    })

    it('does nothing when files array is empty', () => {
      gitStage('/tmp/repo', [])

      expect(execFileSync).not.toHaveBeenCalled()
    })
  })

  describe('shell injection — gitCommit uses execFileSync (safe)', () => {
    it('uses execFileSync — shell metacharacters are treated as literals', () => {
      // execFileSync does not invoke a shell, so $(whoami) is passed as a
      // literal string to git, not interpreted by the shell.
      const malicious = '$(whoami)'
      gitCommit('/tmp/repo', malicious)

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', '$(whoami)'],
        expect.any(Object)
      )
      // Verify execSync was NOT used for commit
      expect(execSync).not.toHaveBeenCalled()
    })
  })

  describe('gitPush', () => {
    it('returns stdout on success', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: 'Everything up-to-date',
        stderr: '',
        error: undefined,
      } as any)

      const result = gitPush('/tmp/repo')
      expect(result).toBe('Everything up-to-date')
    })

    it('throws on non-zero exit code', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'error: failed to push some refs',
        error: undefined,
      } as any)

      expect(() => gitPush('/tmp/repo')).toThrow('error: failed to push some refs')
    })

    it('throws on spawn error', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: null,
        stdout: '',
        stderr: '',
        error: new Error('spawn git ENOENT'),
      } as any)

      expect(() => gitPush('/tmp/repo')).toThrow('spawn git ENOENT')
    })

    it('uses fallback message when stderr is empty on failure', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 128,
        stdout: '',
        stderr: '',
        error: undefined,
      } as any)

      expect(() => gitPush('/tmp/repo')).toThrow('git push exited with code 128')
    })
  })

  describe('gitStatus', () => {
    it('parses porcelain output correctly', () => {
      vi.mocked(execSync).mockReturnValue('M  src/file.ts\n?? untracked.ts\n')

      const result = gitStatus('/tmp/repo')
      expect(result.files).toContainEqual({ path: 'src/file.ts', status: 'M', staged: true })
      expect(result.files).toContainEqual({ path: 'untracked.ts', status: '?', staged: false })
    })

    it('returns empty files on error', () => {
      vi.mocked(execSync).mockImplementation(() => { throw new Error('not a git repo') })

      const result = gitStatus('/tmp/repo')
      expect(result.files).toEqual([])
    })
  })

  describe('gitBranches', () => {
    it('parses branch output and identifies current branch', () => {
      vi.mocked(execSync).mockReturnValue('  feat/test\n* main\n  develop\n')

      const result = gitBranches('/tmp/repo')
      expect(result.current).toBe('main')
      expect(result.branches).toEqual(['feat/test', 'main', 'develop'])
    })

    it('returns empty on error', () => {
      vi.mocked(execSync).mockImplementation(() => { throw new Error('fail') })

      const result = gitBranches('/tmp/repo')
      expect(result.current).toBe('')
      expect(result.branches).toEqual([])
    })
  })

  describe('gitUnstage', () => {
    it('calls execFileSync with reset HEAD args', () => {
      gitUnstage('/tmp/repo', ['file1.ts'])

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['reset', 'HEAD', '--', 'file1.ts'],
        { cwd: '/tmp/repo', encoding: 'utf-8' }
      )
    })

    it('does nothing when files array is empty', () => {
      gitUnstage('/tmp/repo', [])

      expect(execFileSync).not.toHaveBeenCalled()
    })
  })

  describe('gitDiffFile', () => {
    it('calls execFileSync for both staged and unstaged diffs', () => {
      vi.mocked(execFileSync)
        .mockReturnValueOnce('unstaged diff\n')
        .mockReturnValueOnce('staged diff\n')

      const result = gitDiffFile('/tmp/repo', 'src/file.ts')

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['diff', '--', 'src/file.ts'],
        expect.objectContaining({ cwd: '/tmp/repo' })
      )
      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['diff', '--cached', '--', 'src/file.ts'],
        expect.objectContaining({ cwd: '/tmp/repo' })
      )
      expect(result).toContain('staged diff')
    })

    it('uses execFileSync not execSync — filenames with special chars are safe', () => {
      vi.mocked(execFileSync).mockReturnValue('')

      gitDiffFile('/tmp/repo', 'file$(whoami).ts')

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['diff', '--', 'file$(whoami).ts'],
        expect.any(Object)
      )
      expect(execSync).not.toHaveBeenCalled()
    })

    it('returns empty string on error', () => {
      vi.mocked(execFileSync).mockImplementationOnce(() => { throw new Error('fail') })

      expect(gitDiffFile('/tmp/repo')).toBe('')
    })
  })

  describe('shell injection — gitStage uses execFileSync (safe)', () => {
    it('filenames with shell metacharacters are passed as array args, not interpolated', () => {
      gitStage('/tmp/repo', ['$(rm -rf /)', 'file;echo pwned'])

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['add', '--', '$(rm -rf /)', 'file;echo pwned'],
        expect.any(Object)
      )
      expect(execSync).not.toHaveBeenCalled()
    })
  })

  describe('shell injection — gitCheckout uses execFileSync (safe)', () => {
    it('branch names with semicolons do not inject', () => {
      gitCheckout('/tmp/repo', 'branch;rm -rf /')

      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['checkout', 'branch;rm -rf /'],
        expect.any(Object)
      )
      expect(execSync).not.toHaveBeenCalled()
    })
  })

  describe('getRepoPaths', () => {
    it('returns a copy of REPO_PATHS', () => {
      const paths = getRepoPaths()
      expect(paths).toHaveProperty('BDE')
      expect(paths).toHaveProperty('life-os')
      expect(paths).toHaveProperty('feast')
    })
  })
})
