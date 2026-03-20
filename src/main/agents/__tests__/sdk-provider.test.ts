import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentEvent } from '../types'

// --- Module mocks ---

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}))

vi.mock('../../settings', () => ({
  getAgentBinary: vi.fn().mockReturnValue('claude'),
  getAgentPermissionMode: vi.fn().mockReturnValue('bypassPermissions'),
}))

import { query } from '@anthropic-ai/claude-agent-sdk'
import { SdkProvider } from '../sdk-provider'

// --- Helpers ---

/** Create a mock Query (AsyncGenerator + control methods) from a list of messages. */
function createMockQuery(messages: unknown[]) {
  async function* generate() {
    for (const msg of messages) yield msg
  }
  const gen = generate()
  return Object.assign(gen, {
    close: vi.fn(),
    interrupt: vi.fn().mockResolvedValue(undefined),
    streamInput: vi.fn().mockResolvedValue(undefined),
  })
}

/** Collect all events from an AgentHandle's event stream. */
async function collectEvents(handle: { events: AsyncIterable<AgentEvent> }): Promise<AgentEvent[]> {
  const events: AgentEvent[] = []
  for await (const event of handle.events) {
    events.push(event)
  }
  return events
}

describe('SdkProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── spawn shape ──────────────────────────────────────────────────────

  it('spawn() returns an AgentHandle with expected shape', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({
      prompt: 'test',
      workingDirectory: '/tmp/test',
    })

    expect(handle.id).toBeDefined()
    expect(handle.events).toBeDefined()
    expect(typeof handle.steer).toBe('function')
    expect(typeof handle.stop).toBe('function')
    expect(handle.logPath).toBeUndefined()
  })

  // ── query args ───────────────────────────────────────────────────────

  it('passes prompt and cwd to SDK query()', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    await new SdkProvider().spawn({
      prompt: 'fix the bug',
      workingDirectory: '/home/user/project',
    })

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'fix the bug',
        options: expect.objectContaining({
          cwd: '/home/user/project',
        }),
      }),
    )
  })

  it('prepends templatePrefix to prompt', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    await new SdkProvider().spawn({
      prompt: 'do stuff',
      workingDirectory: '/tmp',
      templatePrefix: 'You are a code reviewer.',
    })

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'You are a code reviewer.\n\ndo stuff',
      }),
    )
  })

  it('maps BDE model id to full model id', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    await new SdkProvider().spawn({
      prompt: 'test',
      workingDirectory: '/tmp',
      model: 'opus',
    })

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          model: 'claude-opus-4-6',
        }),
      }),
    )
  })

  it('sets bypassPermissions with allowDangerouslySkipPermissions', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    await new SdkProvider().spawn({
      prompt: 'test',
      workingDirectory: '/tmp',
    })

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        }),
      }),
    )
  })

  it('passes abortController in options', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    await new SdkProvider().spawn({
      prompt: 'test',
      workingDirectory: '/tmp',
    })

    const opts = vi.mocked(query).mock.calls[0][0].options
    expect(opts?.abortController).toBeInstanceOf(AbortController)
  })

  // ── agentId ──────────────────────────────────────────────────────────

  it('uses agentId from options when provided', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({
      prompt: 'test',
      workingDirectory: '/tmp',
      agentId: 'my-sdk-id',
    })

    expect(handle.id).toBe('my-sdk-id')
  })

  // ── event mapping ────────────────────────────────────────────────────

  it('maps system init to agent:started', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        { type: 'system', subtype: 'init', model: 'claude-sonnet-4-6', cwd: '/tmp' },
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })
    const events = await collectEvents(handle)

    expect(events[0]).toMatchObject({ type: 'agent:started', model: 'claude-sonnet-4-6' })
  })

  it('maps assistant text blocks to agent:text', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Hello world!' }],
          },
        },
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })
    const events = await collectEvents(handle)

    const textEvent = events.find((e) => e.type === 'agent:text')
    expect(textEvent).toBeDefined()
    if (textEvent?.type === 'agent:text') {
      expect(textEvent.text).toBe('Hello world!')
    }
  })

  it('maps assistant tool_use blocks to agent:tool_call', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', id: 'tu_1', name: 'Read', input: { path: '/tmp/foo' } },
            ],
          },
        },
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })
    const events = await collectEvents(handle)

    const toolEvent = events.find((e) => e.type === 'agent:tool_call')
    expect(toolEvent).toBeDefined()
    if (toolEvent?.type === 'agent:tool_call') {
      expect(toolEvent.tool).toBe('Read')
      expect(toolEvent.input).toEqual({ path: '/tmp/foo' })
    }
  })

  it('maps assistant thinking blocks to agent:thinking', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        {
          type: 'assistant',
          message: {
            content: [{ type: 'thinking', thinking: 'Let me think...' }],
          },
        },
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })
    const events = await collectEvents(handle)

    const thinkEvent = events.find((e) => e.type === 'agent:thinking')
    expect(thinkEvent).toBeDefined()
    if (thinkEvent?.type === 'agent:thinking') {
      expect(thinkEvent.text).toBe('Let me think...')
    }
  })

  it('maps result success to agent:completed with cost data', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        {
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.12,
          duration_ms: 45000,
          usage: {
            inputTokens: 5000,
            outputTokens: 2000,
          },
        },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })
    const events = await collectEvents(handle)

    const completed = events.find((e) => e.type === 'agent:completed')
    expect(completed).toBeDefined()
    if (completed?.type === 'agent:completed') {
      expect(completed.exitCode).toBe(0)
      expect(completed.costUsd).toBe(0.12)
      expect(completed.tokensIn).toBe(5000)
      expect(completed.tokensOut).toBe(2000)
      expect(completed.durationMs).toBe(45000)
    }
  })

  it('maps result error to agent:error + agent:completed', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        {
          type: 'result',
          subtype: 'error_during_execution',
          total_cost_usd: 0.01,
          duration_ms: 5000,
          usage: { inputTokens: 100, outputTokens: 50 },
          errors: ['Something went wrong'],
        },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })
    const events = await collectEvents(handle)

    expect(events.some((e) => e.type === 'agent:error')).toBe(true)
    const completed = events.find((e) => e.type === 'agent:completed')
    expect(completed).toBeDefined()
    if (completed?.type === 'agent:completed') {
      expect(completed.exitCode).toBe(1)
    }
  })

  it('maps api_retry to agent:rate_limited', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        {
          type: 'system',
          subtype: 'api_retry',
          attempt: 2,
          retry_delay_ms: 30000,
        },
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })
    const events = await collectEvents(handle)

    const rateLimited = events.find((e) => e.type === 'agent:rate_limited')
    expect(rateLimited).toBeDefined()
    if (rateLimited?.type === 'agent:rate_limited') {
      expect(rateLimited.retryDelayMs).toBe(30000)
      expect(rateLimited.attempt).toBe(2)
    }
  })

  it('yields multiple events from multi-block assistant message', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'First' },
              { type: 'tool_use', id: 'tu_1', name: 'Bash', input: { command: 'ls' } },
            ],
          },
        },
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })
    const events = await collectEvents(handle)

    const textEvent = events.find((e) => e.type === 'agent:text')
    const toolEvent = events.find((e) => e.type === 'agent:tool_call')
    expect(textEvent).toBeDefined()
    expect(toolEvent).toBeDefined()
  })

  // ── steer ────────────────────────────────────────────────────────────

  it('steer() calls streamInput with user message', async () => {
    const mockQuery = createMockQuery([
      { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
    ])
    vi.mocked(query).mockReturnValue(mockQuery as never)

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })

    await handle.steer('follow up message')

    expect(mockQuery.streamInput).toHaveBeenCalledTimes(1)
  })

  // ── stop ─────────────────────────────────────────────────────────────

  it('stop() aborts the session via AbortController', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })

    // Capture the abort controller from the query call
    const opts = vi.mocked(query).mock.calls[0][0].options
    const controller = opts?.abortController as AbortController
    expect(controller.signal.aborted).toBe(false)

    await handle.stop()

    expect(controller.signal.aborted).toBe(true)
  })

  // ── unknown events ───────────────────────────────────────────────────

  it('ignores unknown SDK message types', async () => {
    vi.mocked(query).mockReturnValue(
      createMockQuery([
        { type: 'system', subtype: 'status', status: 'compacting' },
        { type: 'tool_progress', tool_use_id: 'tu_1', tool_name: 'Bash', elapsed_time_seconds: 5 },
        { type: 'result', subtype: 'success', total_cost_usd: 0, duration_ms: 0, usage: {} },
      ]) as never,
    )

    const handle = await new SdkProvider().spawn({ prompt: 'test', workingDirectory: '/tmp' })
    const events = await collectEvents(handle)

    // Only the completed event should be present
    expect(events.every((e) => e.type === 'agent:completed')).toBe(true)
  })
})
