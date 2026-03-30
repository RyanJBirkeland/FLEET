import type { AgentHandle, SteerResult, Logger } from './types'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { buildAgentEnv, getOAuthToken } from '../env-utils'

export async function spawnAgent(opts: {
  prompt: string
  cwd: string
  model: string
  logger?: Logger
}): Promise<AgentHandle> {
  const env = { ...buildAgentEnv() }

  // Get OAuth token for SDK auth parameter.
  // Do NOT pass token via environment variable (AM-RED-2).
  const token = getOAuthToken()

  // Try SDK first, fall back to CLI
  try {
    const sdk = await import('@anthropic-ai/claude-agent-sdk')
    return spawnViaSdk(sdk, opts, env, token, opts.logger)
  } catch {
    // SDK not available — use CLI fallback
  }

  return spawnViaCli(opts, env, token, opts.logger)
}

function spawnViaSdk(
  sdk: typeof import('@anthropic-ai/claude-agent-sdk'),
  opts: { prompt: string; cwd: string; model: string },
  env: NodeJS.ProcessEnv,
  apiKey: string | null,
  logger?: Logger
): AgentHandle {
  const abortController = new AbortController()

  const queryResult = sdk.query({
    prompt: opts.prompt,
    options: {
      model: opts.model,
      cwd: opts.cwd,
      env: env as Record<string, string | undefined>,
      // AM-RED-1: Removed bypassPermissions - agents now respect permission prompts
      // AM-RED-2: Pass auth via apiKey parameter instead of environment variable
      ...(apiKey ? { apiKey } : {}),
      abortController,
      settingSources: ['user', 'project', 'local']
    }
  })

  // Extract sessionId from the first message that carries it
  let resolvedSessionId = randomUUID()

  async function* wrapMessages(): AsyncIterable<unknown> {
    for await (const msg of queryResult) {
      if (typeof msg === 'object' && msg !== null && 'session_id' in msg) {
        const sid = (msg as Record<string, unknown>).session_id
        if (typeof sid === 'string' && sid !== resolvedSessionId) {
          resolvedSessionId = sid as ReturnType<typeof randomUUID>
        }
      }
      yield msg
    }
  }

  return {
    messages: wrapMessages(),
    get sessionId() {
      return resolvedSessionId
    },
    abort() {
      abortController.abort()
    },
    async steer(message: string): Promise<SteerResult> {
      try {
        ;(logger ?? console).warn(
          `[agent-manager] Steer in SDK mode is not supported — interrupting agent instead: "${message.slice(0, 100)}"`
        )
        await queryResult.interrupt()
        // Re-send via streamInput is not straightforward for a single query.
        // The interrupt signals the agent, but the steer message cannot be delivered.
        // Full steer support requires streaming input mode; this path is unsupported.
        return { delivered: false, error: 'SDK mode does not support steer - agent interrupted instead' }
      } catch (err) {
        return { delivered: false, error: String(err) }
      }
    }
  }
}

function spawnViaCli(
  opts: { prompt: string; cwd: string; model: string },
  env: NodeJS.ProcessEnv,
  apiKey: string | null,
  _logger?: Logger
): AgentHandle {
  // AM-RED-2: Pass auth via ANTHROPIC_API_KEY for CLI (no auth parameter available in CLI)
  if (apiKey) {
    env = { ...env, ANTHROPIC_API_KEY: apiKey }
  }

  const child = spawn(
    'claude',
    [
      '--output-format',
      'stream-json',
      '--input-format',
      'stream-json',
      '--verbose',
      '--model',
      opts.model
      // AM-RED-1: Removed --permission-mode bypassPermissions
    ],
    {
      cwd: opts.cwd,
      env: env as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    }
  )

  // Capture stderr line-by-line and forward via onStderr callback
  let stderrBuffer = ''
  child.stderr.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString()
    const lines = stderrBuffer.split('\n')
    stderrBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && handle.onStderr) {
        handle.onStderr(trimmed)
      }
    }
  })
  child.stderr.on('end', () => {
    const trimmed = stderrBuffer.trim()
    if (trimmed && handle.onStderr) {
      handle.onStderr(trimmed)
    }
    stderrBuffer = ''
  })

  const sessionId = randomUUID()

  // Send initial prompt via stdin
  child.stdin.write(
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: opts.prompt },
      parent_tool_use_id: null,
      session_id: sessionId
    }) + '\n'
  )

  async function* parseMessages(): AsyncIterable<unknown> {
    let buffer = ''
    for await (const chunk of child.stdout) {
      buffer += (chunk as Buffer).toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          yield JSON.parse(line)
        } catch {
          /* skip non-JSON */
        }
      }
    }
  }

  const handle: AgentHandle = {
    messages: parseMessages(),
    sessionId,
    abort() {
      child.kill('SIGTERM')
    },
    async steer(message: string): Promise<SteerResult> {
      try {
        if (!child.stdin.writable) {
          return { delivered: false, error: 'Agent stdin is no longer writable' }
        }
        child.stdin.write(
          JSON.stringify({
            type: 'user',
            message: { role: 'user', content: message },
            parent_tool_use_id: null,
            session_id: sessionId
          }) + '\n'
        )
        return { delivered: true }
      } catch (err) {
        return { delivered: false, error: String(err) }
      }
    }
  }

  return handle
}
