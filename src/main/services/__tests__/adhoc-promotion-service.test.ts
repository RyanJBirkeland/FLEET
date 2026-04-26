import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn() }
})
vi.mock('../../lib/async-utils', () => ({ execFileAsync: vi.fn() }))
vi.mock('../sprint-service', () => ({ createReviewTaskFromAdhoc: vi.fn() }))
vi.mock('../../env-utils', () => ({ buildAgentEnv: vi.fn(() => ({})) }))

import { existsSync } from 'node:fs'
import { execFileAsync } from '../../lib/async-utils'
import { createReviewTaskFromAdhoc } from '../sprint-service'
import { promoteAdhocToTask } from '../adhoc-promotion-service'
import type { AgentMeta } from '../../agent-history'

function makeAgent(overrides: Partial<AgentMeta> = {}): AgentMeta {
  return {
    id: 'agent-1',
    pid: null,
    bin: 'claude',
    model: 'opus',
    repo: 'bde',
    repoPath: '/tmp/bde',
    task: 'Fix the login bug',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    exitCode: 0,
    status: 'done',
    logPath: '/tmp/log',
    source: 'adhoc',
    costUsd: null,
    tokensIn: null,
    tokensOut: null,
    sprintTaskId: null,
    worktreePath: '/tmp/adhoc-worktree',
    branch: 'agent/adhoc-123',
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(existsSync).mockReturnValue(true)
  vi.mocked(execFileAsync).mockResolvedValue({ stdout: '3\n', stderr: '' })
  vi.mocked(createReviewTaskFromAdhoc).mockReturnValue({ id: 'task-abc' } as never)
})

describe('promoteAdhocToTask — happy path', () => {
  it('returns ok: true and calls createReviewTaskFromAdhoc once', async () => {
    const result = await promoteAdhocToTask('agent-1', makeAgent())

    expect(result.ok).toBe(true)
    expect(result.taskId).toBe('task-abc')
    expect(createReviewTaskFromAdhoc).toHaveBeenCalledOnce()
    expect(createReviewTaskFromAdhoc).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
        repo: 'bde',
        worktreePath: '/tmp/adhoc-worktree',
        branch: 'agent/adhoc-123'
      })
    )
  })
})

describe('promoteAdhocToTask — missing worktree', () => {
  it('returns ok: false when worktreePath is null', async () => {
    const result = await promoteAdhocToTask('agent-1', makeAgent({ worktreePath: null }))

    expect(result.ok).toBe(false)
    expect(result.error).toContain('no worktree')
    expect(createReviewTaskFromAdhoc).not.toHaveBeenCalled()
  })

  it('returns ok: false when worktree path does not exist on disk', async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const result = await promoteAdhocToTask('agent-1', makeAgent())

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Worktree no longer exists')
    expect(createReviewTaskFromAdhoc).not.toHaveBeenCalled()
  })

  it('returns ok: false when agent has no branch recorded', async () => {
    const result = await promoteAdhocToTask('agent-1', makeAgent({ branch: null }))

    expect(result.ok).toBe(false)
    expect(result.error).toContain('no branch')
    expect(createReviewTaskFromAdhoc).not.toHaveBeenCalled()
  })
})

describe('promoteAdhocToTask — no commits', () => {
  it('returns ok: false when git rev-list returns 0 commits', async () => {
    vi.mocked(execFileAsync).mockResolvedValue({ stdout: '0\n', stderr: '' })

    const result = await promoteAdhocToTask('agent-1', makeAgent())

    expect(result.ok).toBe(false)
    expect(result.error).toContain('not committed any work')
    expect(createReviewTaskFromAdhoc).not.toHaveBeenCalled()
  })
})

describe('promoteAdhocToTask — createReviewTaskFromAdhoc failure', () => {
  it('returns ok: false when createReviewTaskFromAdhoc returns null', async () => {
    vi.mocked(createReviewTaskFromAdhoc).mockReturnValue(null as never)

    const result = await promoteAdhocToTask('agent-1', makeAgent())

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Failed to create review task')
  })
})
