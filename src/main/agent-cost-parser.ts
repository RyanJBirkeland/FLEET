/**
 * Agent cost extraction — parse cost data from agent log files and persist to DB.
 */
import { readFile } from 'fs/promises'
import { getDb } from './db'
import { updateAgentRunCost as _updateAgentRunCost } from './data/agent-queries'
import type { Result } from '../shared/types'

export interface AgentCost {
  costUsd: number
  tokensIn: number
  tokensOut: number
  cacheRead: number
  cacheCreate: number
  durationMs: number
  numTurns: number
}

export async function extractAgentCost(logPath: string): Promise<Result<AgentCost | null>> {
  try {
    const content = await readFile(logPath, 'utf-8')
    const lines = content.split('\n')

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (!line) continue

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }

      // Unwrap stream_event wrapper if present
      if (parsed.type === 'stream_event' && parsed.event && typeof parsed.event === 'object') {
        parsed = parsed.event as Record<string, unknown>
      }

      // Support both legacy result events and new agent:completed events
      if (parsed.type === 'result') {
        const usage = parsed.usage as Record<string, number> | undefined
        return {
          ok: true,
          data: {
            costUsd: typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : 0,
            tokensIn: usage?.input_tokens ?? 0,
            tokensOut: usage?.output_tokens ?? 0,
            cacheRead: usage?.cache_read_input_tokens ?? 0,
            cacheCreate: usage?.cache_creation_input_tokens ?? 0,
            durationMs: typeof parsed.duration_ms === 'number' ? parsed.duration_ms : 0,
            numTurns: typeof parsed.num_turns === 'number' ? parsed.num_turns : 0,
          },
        }
      }

      if (parsed.type === 'agent:completed') {
        return {
          ok: true,
          data: {
            costUsd: typeof parsed.costUsd === 'number' ? parsed.costUsd : 0,
            tokensIn: typeof parsed.tokensIn === 'number' ? parsed.tokensIn : 0,
            tokensOut: typeof parsed.tokensOut === 'number' ? parsed.tokensOut : 0,
            cacheRead: 0,
            cacheCreate: 0,
            durationMs: typeof parsed.durationMs === 'number' ? parsed.durationMs : 0,
            numTurns: 0,
          },
        }
      }
    }

    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, error: `Failed to extract agent cost from ${logPath}: ${(err as Error).message}` }
  }
}

export function updateAgentRunCost(agentRunId: string, cost: AgentCost): void {
  _updateAgentRunCost(getDb(), agentRunId, cost)
}
