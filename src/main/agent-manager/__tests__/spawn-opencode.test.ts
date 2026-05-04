/**
 * Tests for spawn-opencode.ts argument construction.
 *
 * T-33: prompt must appear after a `--` separator so CLI option parsers
 * cannot interpret flag-like content (e.g. `--model`, `--session`) as
 * opencode flags.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: {
      [Symbol.asyncIterator]: async function* () {},
      setMaxListeners: vi.fn()
    },
    stderr: {
      on: vi.fn(),
      setMaxListeners: vi.fn()
    },
    kill: vi.fn()
  }))
}))

const mockSpawn = vi.mocked(spawn)

// Import after mocking so the module picks up the mock
import { spawnOpencode } from '../spawn-opencode'

describe('spawnOpencode — argument layout (T-33)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('places the prompt after a -- separator so CLI parsers treat it as positional data', async () => {
    await spawnOpencode({
      prompt: 'Fix the login bug',
      cwd: '/some/worktree',
      model: 'claude-opus-4-5'
    })

    expect(mockSpawn).toHaveBeenCalledOnce()
    const [, args] = mockSpawn.mock.calls[0]!
    const separatorIndex = (args as string[]).indexOf('--')
    expect(separatorIndex).toBeGreaterThan(-1)
    const promptIndex = (args as string[]).indexOf('Fix the login bug')
    expect(promptIndex).toBeGreaterThan(separatorIndex)
  })

  it('places prompt after -- even when it looks like a flag (e.g. --model)', async () => {
    const flagLookingPrompt = '--model claude-opus-4-5 --session abc'
    await spawnOpencode({
      prompt: flagLookingPrompt,
      cwd: '/some/worktree',
      model: 'claude-opus-4-5'
    })

    const [, args] = mockSpawn.mock.calls[0]!
    const separatorIndex = (args as string[]).indexOf('--')
    expect(separatorIndex).toBeGreaterThan(-1)
    const promptIndex = (args as string[]).indexOf(flagLookingPrompt)
    expect(promptIndex).toBeGreaterThan(separatorIndex)
  })

  it('does not place the prompt before the -- separator', async () => {
    await spawnOpencode({
      prompt: 'Do something',
      cwd: '/wt',
      model: 'claude-sonnet-4-6'
    })

    const [, args] = mockSpawn.mock.calls[0]!
    const separatorIndex = (args as string[]).indexOf('--')
    const argsBefore = (args as string[]).slice(0, separatorIndex)
    expect(argsBefore).not.toContain('Do something')
  })

  it('still passes --format, --dir, --model flags before the separator', async () => {
    await spawnOpencode({
      prompt: 'Some task',
      cwd: '/the/worktree',
      model: 'claude-haiku-3-5'
    })

    const [, args] = mockSpawn.mock.calls[0]!
    const separatorIndex = (args as string[]).indexOf('--')
    const argsBefore = (args as string[]).slice(0, separatorIndex)
    expect(argsBefore).toContain('--format')
    expect(argsBefore).toContain('--dir')
    expect(argsBefore).toContain('--model')
  })

  it('includes optional --session arg before the separator when sessionId is provided', async () => {
    await spawnOpencode({
      prompt: 'Continue task',
      cwd: '/wt',
      model: 'claude-opus-4-5',
      sessionId: 'abc-123'
    })

    const [, args] = mockSpawn.mock.calls[0]!
    const separatorIndex = (args as string[]).indexOf('--')
    const argsBefore = (args as string[]).slice(0, separatorIndex)
    expect(argsBefore).toContain('--session')
    expect(argsBefore).toContain('abc-123')
  })
})
