/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, existsSync: vi.fn() }
})
vi.mock('../../logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))
vi.mock('../../env-utils', () => ({
  buildAgentEnv: vi.fn(() => ({ PATH: '/usr/bin' }))
}))
vi.mock('../../lib/async-utils', () => ({
  execFileAsync: vi.fn()
}))
vi.mock('../../agent-history', () => ({
  getAgentMeta: vi.fn()
}))
vi.mock('../sprint-service', () => ({
  createReviewTaskFromAdhoc: vi.fn()
}))

import { existsSync } from 'node:fs'
import { execFileAsync } from '../../lib/async-utils'
import { getAgentMeta } from '../../agent-history'
import { createReviewTaskFromAdhoc } from '../sprint-service'
import { promoteAdhocToTask } from '../adhoc-promotion-service'
import type { AgentMeta } from '../../../shared/types'

const mockExistsSync = vi.mocked(existsSync)
const mockExecFileAsync = vi.mocked(execFileAsync)
const mockGetAgentMeta = vi.mocked(getAgentMeta)
const mockCreateReviewTask = vi.mocked(createReviewTaskFromAdhoc)

function makeAgent(overrides: Partial<AgentMeta> = {}): AgentMeta {
  return {
    id: 'agent-1',
    task: 'Implement feature X',
    status: 'done',
    worktreePath: '/tmp/worktree',
    branch: 'adhoc/feature-x',
    repo: 'bde',
    logPath: '/tmp/agent.log',
    sprintTaskId: null,
    agentType: 'adhoc',
    createdAt: '2026-04-22T00:00:00Z',
    updatedAt: '2026-04-22T00:00:00Z',
    sessionId: null,
    ...overrides
  } as AgentMeta
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExistsSync.mockReturnValue(true)
  mockExecFileAsync.mockResolvedValue({ stdout: '2\n', stderr: '' })
  mockGetAgentMeta.mockResolvedValue(makeAgent())
  mockCreateReviewTask.mockReturnValue({ id: 'task-abc' } as ReturnType<
    typeof createReviewTaskFromAdhoc
  >)
})

describe('promoteAdhocToTask', () => {
  describe('agent not found', () => {
    it('returns error when agent does not exist', async () => {
      mockGetAgentMeta.mockResolvedValue(null)

      const result = await promoteAdhocToTask('missing-agent')

      expect(result).toEqual({ ok: false, error: 'Agent missing-agent not found' })
    })
  })

  describe('idempotency', () => {
    it('returns existing taskId without creating a new task when already promoted', async () => {
      mockGetAgentMeta.mockResolvedValue(makeAgent({ sprintTaskId: 'existing-task-id' }))

      const result = await promoteAdhocToTask('agent-1')

      expect(result).toEqual({ ok: true, taskId: 'existing-task-id' })
      expect(mockCreateReviewTask).not.toHaveBeenCalled()
    })
  })

  describe('precondition checks', () => {
    it('returns error when agent has no worktree path', async () => {
      mockGetAgentMeta.mockResolvedValue(makeAgent({ worktreePath: undefined }))

      const result = await promoteAdhocToTask('agent-1')

      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/no worktree/)
    })

    it('returns error when worktree path does not exist on disk', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await promoteAdhocToTask('agent-1')

      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/no longer exists/)
    })

    it('returns error when agent has no branch recorded', async () => {
      mockGetAgentMeta.mockResolvedValue(makeAgent({ branch: undefined }))

      const result = await promoteAdhocToTask('agent-1')

      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/no branch/)
    })

    it('returns error when agent has no commits beyond main', async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: '0\n', stderr: '' })

      const result = await promoteAdhocToTask('agent-1')

      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/not committed any work/)
    })
  })

  describe('successful promotion', () => {
    it('creates a review task and returns its id', async () => {
      const result = await promoteAdhocToTask('agent-1')

      expect(mockCreateReviewTask).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'adhoc/feature-x', repo: 'bde' })
      )
      expect(result).toEqual({ ok: true, taskId: 'task-abc' })
    })

    it('accepts trigger option without affecting the result shape', async () => {
      const result = await promoteAdhocToTask('agent-1', { trigger: 'tool' })

      expect(result).toEqual({ ok: true, taskId: 'task-abc' })
    })

    it('returns error when createReviewTaskFromAdhoc returns null', async () => {
      mockCreateReviewTask.mockReturnValue(null)

      const result = await promoteAdhocToTask('agent-1')

      expect(result).toEqual({ ok: false, error: 'Failed to create review task — see logs' })
    })
  })
})
