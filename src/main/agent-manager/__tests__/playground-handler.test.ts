import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('../../agent-event-mapper', () => ({
  emitAgentEvent: vi.fn()
}))

import { tryEmitPlaygroundEvent } from '../playground-handler'
import { emitAgentEvent } from '../../agent-event-mapper'

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}

describe('tryEmitPlaygroundEvent', () => {
  let worktreeDir: string
  let outsideDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    worktreeDir = mkdtempSync(join(tmpdir(), 'pg-worktree-'))
    outsideDir = mkdtempSync(join(tmpdir(), 'pg-outside-'))
  })

  afterEach(() => {
    rmSync(worktreeDir, { recursive: true, force: true })
    rmSync(outsideDir, { recursive: true, force: true })
  })

  it('emits event when file lives inside the worktree', async () => {
    const filePath = join(worktreeDir, 'card.html')
    writeFileSync(filePath, '<!DOCTYPE html><html><body>hi</body></html>')

    await tryEmitPlaygroundEvent({
      taskId: 'task-1',
      filePath,
      worktreePath: worktreeDir,
      logger: makeLogger()
    })

    expect(emitAgentEvent).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        type: 'agent:playground',
        filename: 'card.html',
        contentType: 'html'
      })
    )
  })

  it('drops event when file is outside worktree and allowAnyPath is not set', async () => {
    const filePath = join(outsideDir, 'card.html')
    writeFileSync(filePath, '<!DOCTYPE html><html><body>hi</body></html>')
    const logger = makeLogger()

    await tryEmitPlaygroundEvent({
      taskId: 'task-1',
      filePath,
      worktreePath: worktreeDir,
      logger
    })

    expect(emitAgentEvent).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Path traversal blocked'))
  })

  it('emits event when file is outside worktree and allowAnyPath is true', async () => {
    const filePath = join(outsideDir, 'card.html')
    writeFileSync(filePath, '<!DOCTYPE html><html><body>outside-worktree</body></html>')

    await tryEmitPlaygroundEvent({
      taskId: 'task-1',
      filePath,
      worktreePath: worktreeDir,
      logger: makeLogger(),
      allowAnyPath: true
    })

    expect(emitAgentEvent).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        type: 'agent:playground',
        filename: 'card.html',
        contentType: 'html'
      })
    )
  })

  it('drops event when file does not exist', async () => {
    const logger = makeLogger()

    await tryEmitPlaygroundEvent({
      taskId: 'task-1',
      filePath: join(outsideDir, 'does-not-exist.html'),
      worktreePath: worktreeDir,
      logger,
      allowAnyPath: true
    })

    expect(emitAgentEvent).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('does not exist'))
  })
})
