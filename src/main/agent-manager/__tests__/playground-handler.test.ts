import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
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

  describe('T-8: uses resolvedPath for stat and readFile (TOCTOU fix)', () => {
    it('emits event using the filename from the resolved (canonical) path', async () => {
      // Write a real file and request via its absolute path — resolvedPath === absolutePath here.
      // The point is that stat() and readFile() operate on resolvedPath, not absolutePath.
      const filePath = join(worktreeDir, 'toctou.html')
      writeFileSync(filePath, '<!DOCTYPE html><html><body>safe</body></html>')

      await tryEmitPlaygroundEvent({
        taskId: 'task-toctou',
        filePath,
        worktreePath: worktreeDir,
        logger: makeLogger()
      })

      expect(emitAgentEvent).toHaveBeenCalledWith(
        'task-toctou',
        expect.objectContaining({ filename: 'toctou.html' })
      )
    })
  })

  describe('T-10: resolvedWorktreePath skips realpath call', () => {
    it('accepts resolvedWorktreePath and emits event without re-resolving the worktree', async () => {
      // Provide the pre-resolved (canonical) path directly — should behave identically
      // to the normal path (just skips the extra realpath syscall at runtime).
      // On macOS /tmp is a symlink to /private/tmp, so we must resolve for the
      // containment check to pass when comparing against resolvedPath.
      const filePath = join(worktreeDir, 'fast.html')
      writeFileSync(filePath, '<!DOCTYPE html><html><body>fast</body></html>')
      const canonicalWorktreeDir = realpathSync(worktreeDir)

      await tryEmitPlaygroundEvent({
        taskId: 'task-t10',
        filePath,
        worktreePath: worktreeDir,
        resolvedWorktreePath: canonicalWorktreeDir, // pre-resolved canonical path
        logger: makeLogger()
      })

      expect(emitAgentEvent).toHaveBeenCalledWith(
        'task-t10',
        expect.objectContaining({ type: 'agent:playground', filename: 'fast.html' })
      )
    })

    it('still blocks path traversal when resolvedWorktreePath is provided', async () => {
      const filePath = join(outsideDir, 'evil.html')
      writeFileSync(filePath, '<html></html>')
      const logger = makeLogger()
      const canonicalWorktreeDir = realpathSync(worktreeDir)

      await tryEmitPlaygroundEvent({
        taskId: 'task-t10-block',
        filePath,
        worktreePath: worktreeDir,
        resolvedWorktreePath: canonicalWorktreeDir,
        logger
      })

      expect(emitAgentEvent).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Path traversal blocked'))
    })
  })
})

describe('T-9: typeof guards on unchecked casts in resolvePlaygroundWriteForTool', () => {
  it('returns null when file_path is not a string (number input)', async () => {
    // Import the internal function indirectly via detectPlaygroundWrite
    // by crafting a legacy top-level tool_result message with a numeric file_path.
    const { detectPlaygroundWrite } = await import('../playground-handler')

    const msg = {
      type: 'tool_result',
      tool_name: 'write',
      input: { file_path: 12345 } // non-string — must not cast
    }
    expect(detectPlaygroundWrite(msg)).toBeNull()
  })

  it('returns a hit when file_path is a valid string', async () => {
    const { detectPlaygroundWrite } = await import('../playground-handler')

    const msg = {
      type: 'tool_result',
      tool_name: 'write',
      input: { file_path: '/some/path/output.html' }
    }
    expect(detectPlaygroundWrite(msg)).toEqual({
      path: '/some/path/output.html',
      contentType: 'html'
    })
  })
})
