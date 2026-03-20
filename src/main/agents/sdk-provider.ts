/**
 * SDK Provider — spawns agents via the Claude Agent SDK (`query()`) and
 * converts SDK messages into an AsyncIterable<AgentEvent>.
 */
import { query, type Query } from '@anthropic-ai/claude-agent-sdk'
import { randomUUID } from 'crypto'
import type { AgentProvider, AgentHandle, AgentSpawnOptions, AgentEvent } from './types'
import { CLAUDE_MODELS, DEFAULT_MODEL } from '../../shared/models'
import { getAgentPermissionMode } from '../settings'

function modelToFlag(model?: string): string {
  const entry = CLAUDE_MODELS.find((m) => m.id === model)
  return entry?.modelId ?? DEFAULT_MODEL.modelId
}

/** Map SDK messages to AgentEvent types. Yields zero or more events per message. */
function* mapSdkMessage(msg: Record<string, unknown>): Generator<AgentEvent> {
  const timestamp = Date.now()

  switch (msg.type) {
    case 'system': {
      const subtype = msg.subtype as string
      if (subtype === 'init') {
        yield { type: 'agent:started', model: (msg.model as string) ?? '', timestamp }
      } else if (subtype === 'api_retry') {
        yield {
          type: 'agent:rate_limited',
          retryDelayMs: (msg.retry_delay_ms as number) ?? 0,
          attempt: (msg.attempt as number) ?? 1,
          timestamp,
        }
      }
      break
    }

    case 'assistant': {
      const message = msg.message as Record<string, unknown> | undefined
      const content = message?.content as Array<Record<string, unknown>> | undefined
      if (!content) break

      for (const block of content) {
        switch (block.type) {
          case 'text':
            yield { type: 'agent:text', text: block.text as string, timestamp }
            break
          case 'tool_use':
            yield {
              type: 'agent:tool_call',
              tool: block.name as string,
              summary: block.name as string,
              input: block.input,
              timestamp,
            }
            break
          case 'thinking':
            yield {
              type: 'agent:thinking',
              tokenCount: 0,
              text: (block.thinking as string) ?? '',
              timestamp,
            }
            break
        }
      }
      break
    }

    case 'result': {
      const subtype = msg.subtype as string
      const usage = msg.usage as Record<string, number> | undefined
      const costUsd = typeof msg.total_cost_usd === 'number' ? msg.total_cost_usd : 0
      const durationMs = typeof msg.duration_ms === 'number' ? msg.duration_ms : 0
      const tokensIn = usage?.inputTokens ?? usage?.input_tokens ?? 0
      const tokensOut = usage?.outputTokens ?? usage?.output_tokens ?? 0

      if (subtype !== 'success') {
        const errors = msg.errors as string[] | undefined
        yield {
          type: 'agent:error',
          message: errors?.join('; ') ?? 'Agent execution failed',
          timestamp,
        }
      }

      yield {
        type: 'agent:completed',
        exitCode: subtype === 'success' ? 0 : 1,
        costUsd,
        tokensIn,
        tokensOut,
        durationMs,
        timestamp,
      }
      break
    }
  }
}

/** Convert a Query async iterable into an AsyncIterable<AgentEvent>. */
async function* createSdkEventStream(rawStream: Query): AsyncGenerator<AgentEvent> {
  for await (const msg of rawStream) {
    yield* mapSdkMessage(msg as unknown as Record<string, unknown>)
  }
}

export class SdkProvider implements AgentProvider {
  async spawn(opts: AgentSpawnOptions): Promise<AgentHandle> {
    const id = opts.agentId ?? randomUUID()
    const permissionMode = getAgentPermissionMode()
    const abortController = new AbortController()

    const prompt = opts.templatePrefix
      ? `${opts.templatePrefix}\n\n${opts.prompt}`
      : opts.prompt

    const rawStream = query({
      prompt,
      options: {
        cwd: opts.workingDirectory,
        model: modelToFlag(opts.model),
        permissionMode: permissionMode as 'default' | 'acceptEdits' | 'bypassPermissions',
        allowDangerouslySkipPermissions: permissionMode === 'bypassPermissions',
        abortController,
      },
    })

    return {
      id,
      events: createSdkEventStream(rawStream),
      steer: async (message: string) => {
        const stream = (async function* () {
          yield {
            type: 'user' as const,
            message: { role: 'user' as const, content: message },
            parent_tool_use_id: null,
            session_id: '',
          }
        })()
        await rawStream.streamInput(stream)
      },
      stop: async () => {
        abortController.abort()
      },
    }
  }
}
