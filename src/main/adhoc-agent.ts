/**
 * Ad-hoc agent spawning — launches interactive Claude sessions via SDK v2 Session API
 * for persistent multi-turn conversations.
 *
 * Uses unstable_v2_createSession() which provides a proper multi-turn interface:
 * - session.send(message) to send follow-up messages
 * - session.stream() to consume response messages
 * - session.close() to end the session
 *
 * Previous approach using query() with streamInput() didn't work because query()
 * is a single-turn API — the iterator terminates when the model emits a 'result'
 * message, regardless of maxTurns or canUseTool settings.
 */
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { importAgent, updateAgentMeta } from './agent-history'
import { buildAgentEnvWithAuth } from './env-utils'
import { mapRawMessage, emitAgentEvent } from './agent-event-mapper'
import type { SpawnLocalAgentResult } from '../shared/types'
import { buildAgentPrompt } from './agent-manager/prompt-composer'
import { createLogger } from './logger'

const log = createLogger('adhoc-agent')

/** Wrapper around an SDK Session for ad-hoc agent management */
interface AdhocSession {
  send(message: string): Promise<void>
  close(): void
}

/** Active ad-hoc sessions, keyed by agent run ID */
const adhocSessions = new Map<string, AdhocSession>()

export function getAdhocHandle(agentId: string): AdhocSession | undefined {
  return adhocSessions.get(agentId)
}

export async function spawnAdhocAgent(args: {
  task: string
  repoPath: string
  model?: string
  assistant?: boolean
}): Promise<SpawnLocalAgentResult> {
  const model = args.model || 'claude-sonnet-4-5'
  const env = buildAgentEnvWithAuth()

  const sdk = await import('@anthropic-ai/claude-agent-sdk')

  // Build composed prompt with preamble
  const prompt = buildAgentPrompt({
    agentType: args.assistant ? 'assistant' : 'adhoc',
    taskContent: args.task
  })

  // Create a persistent session (v2 API) — this stays alive for multi-turn
  const session = sdk.unstable_v2_createSession({
    model,
    env: env as Record<string, string>,
    permissionMode: 'default',
    canUseTool: async () => ({ behavior: 'allow' as const })
  })

  // Record in agent_runs
  const repo = basename(args.repoPath).toLowerCase()
  const meta = await importAgent(
    {
      id: randomUUID(),
      pid: null,
      bin: 'claude',
      model,
      repo,
      repoPath: args.repoPath,
      task: args.task,
      status: 'running',
      source: 'adhoc'
    },
    ''
  )

  // Track for steering / kill
  adhocSessions.set(meta.id, {
    async send(message: string) {
      // Emit user message event so it appears in the console UI
      emitAgentEvent(meta.id, {
        type: 'agent:user_message',
        text: message,
        timestamp: Date.now()
      })
      await session.send(message)
    },
    close() {
      session.close()
    }
  })

  // Send the initial prompt
  session.send(prompt).catch((err) => {
    log.error(`[adhoc] ${meta.id} failed to send initial prompt: ${err}`)
  })

  // Consume stream in the background — do NOT await
  consumeStream(meta.id, model, session).catch(() => {})

  return {
    id: meta.id,
    pid: 0,
    logPath: meta.logPath ?? '',
    interactive: true
  }
}

// ---- Background stream consumer ----

async function consumeStream(
  agentId: string,
  model: string,
  session: { stream(): AsyncGenerator<unknown, void>; close(): void }
): Promise<void> {
  const startedAt = Date.now()
  let costUsd = 0
  let tokensIn = 0
  let tokensOut = 0
  let exitCode = 0

  emitAgentEvent(agentId, { type: 'agent:started', model, timestamp: Date.now() })
  log.info(`[adhoc] ${agentId} stream consumer started`)

  try {
    try {
      let messageCount = 0
      for await (const raw of session.stream()) {
        messageCount++

        const events = mapRawMessage(raw)
        for (const event of events) {
          emitAgentEvent(agentId, event)
        }

        // Track cost/token fields if present
        if (typeof raw === 'object' && raw !== null) {
          const r = raw as Record<string, unknown>
          if (typeof r.cost_usd === 'number') costUsd = r.cost_usd
          if (typeof r.total_cost_usd === 'number') costUsd = r.total_cost_usd
          if (typeof r.tokens_in === 'number') tokensIn = r.tokens_in
          if (typeof r.tokens_out === 'number') tokensOut = r.tokens_out
          if (typeof r.exit_code === 'number') exitCode = r.exit_code
          if (typeof r.usage === 'object' && r.usage !== null) {
            const u = r.usage as Record<string, unknown>
            if (typeof u.input_tokens === 'number') tokensIn = u.input_tokens
            if (typeof u.output_tokens === 'number') tokensOut = u.output_tokens
          }
        }
      }
      log.info(`[adhoc] ${agentId} stream ended after ${messageCount} messages`)
    } catch (err) {
      log.error(`[adhoc] ${agentId} stream error: ${err instanceof Error ? err.message : String(err)}`)
      emitAgentEvent(agentId, {
        type: 'agent:error',
        message: err instanceof Error ? err.message : String(err),
        timestamp: Date.now()
      })
    }

    const durationMs = Date.now() - startedAt
    emitAgentEvent(agentId, {
      type: 'agent:completed',
      exitCode,
      costUsd,
      tokensIn,
      tokensOut,
      durationMs,
      timestamp: Date.now()
    })

    try {
      await updateAgentMeta(agentId, {
        status: 'done',
        finishedAt: new Date().toISOString(),
        exitCode
      })
    } catch {
      /* update failure is non-fatal */
    }
  } finally {
    adhocSessions.delete(agentId)
    session.close()
  }
}
