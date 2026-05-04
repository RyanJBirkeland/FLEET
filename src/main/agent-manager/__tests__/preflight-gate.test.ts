import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createPreflightGate } from '../preflight-gate'

describe('PreflightGate', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('resolves true when resolveConfirmation called with proceed=true', async () => {
    const emit = vi.fn()
    const gate = createPreflightGate(emit)
    const promise = gate.requestConfirmation('task-1', ['turbo'], 'my-repo', 'My Task')
    gate.resolveConfirmation('task-1', true)
    expect(await promise).toBe(true)
  })

  it('resolves false when resolveConfirmation called with proceed=false', async () => {
    const emit = vi.fn()
    const gate = createPreflightGate(emit)
    const promise = gate.requestConfirmation('task-1', ['turbo'], 'my-repo', 'My Task')
    gate.resolveConfirmation('task-1', false)
    expect(await promise).toBe(false)
  })

  it('calls the injected emit with agent:preflightWarning on requestConfirmation', async () => {
    const emit = vi.fn()
    const gate = createPreflightGate(emit)
    const promise = gate.requestConfirmation('task-1', ['turbo'], 'my-repo', 'My Task')
    gate.resolveConfirmation('task-1', true)
    await promise
    expect(emit).toHaveBeenCalledWith('agent:preflightWarning', {
      taskId: 'task-1',
      repoName: 'my-repo',
      taskTitle: 'My Task',
      missing: ['turbo'],
      missingEnvVars: []
    })
  })

  it('auto-resolves false after timeout', async () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const gate = createPreflightGate(emit)
    const promise = gate.requestConfirmation('task-2', ['cargo'], 'a-repo', 'A Task')
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(await promise).toBe(false)
  })

  it('noops resolveConfirmation for unknown taskId', () => {
    const emit = vi.fn()
    const gate = createPreflightGate(emit)
    expect(() => gate.resolveConfirmation('no-such-task', true)).not.toThrow()
  })

  it('two tasks do not interfere', async () => {
    const emit = vi.fn()
    const gate = createPreflightGate(emit)
    const p1 = gate.requestConfirmation('task-a', ['turbo'], 'repo', 'Task A')
    const p2 = gate.requestConfirmation('task-b', ['cargo'], 'repo', 'Task B')
    gate.resolveConfirmation('task-a', true)
    gate.resolveConfirmation('task-b', false)
    expect(await p1).toBe(true)
    expect(await p2).toBe(false)
  })
})
