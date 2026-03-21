/**
 * Local agent management — spawn, kill, steer, and manage agent processes.
 * Delegates to SdkProvider for agent spawning.
 * Process scanning logic lives in agent-scanner.ts.
 * Cost extraction lives in agent-cost-parser.ts.
 * Log tailing and cleanup lives in agent-log-manager.ts.
 */
import { randomUUID } from 'crypto'
import { appendFile } from 'fs/promises'
import { basename as pathBasename } from 'path'
import {
  createAgentRecord,
  updateAgentMeta,
} from './agent-history'
import { updateAgentRunCost } from './agent-cost-parser'
import { SdkProvider, type AgentHandle } from './agents'
import { getEventBus } from './agents/event-bus'

// Re-export scanner types and functions for consumers
export type { LocalAgentProcess, PsCandidate } from './agent-scanner'
export {
  KNOWN_AGENT_BINS,
  scanAgentProcesses,
  resolveProcessDetails,
  evictStaleCwdCache,
  reconcileStaleAgents,
  getAgentProcesses,
  getProcessCwd,
  _resetReconcileThrottle,
  _resetProcessCache,
} from './agent-scanner'

// Re-export cost and log types/functions so existing consumers can still import from here
export type { AgentCost } from './agent-cost-parser'
export { extractAgentCost, updateAgentRunCost } from './agent-cost-parser'
export type { TailLogArgs, TailLogResult } from './agent-log-manager'
export { tailAgentLog, cleanupOldLogs } from './agent-log-manager'

// Track active agent handles for PID-based interactive messaging
const activeAgentProcesses = new Map<number, AgentHandle>()

// Track active agent handles by agent ID for steering from Sprint LogDrawer
const activeAgentsById = new Map<string, AgentHandle>()

// --- Spawn an agent via SdkProvider ---

export type { SpawnLocalAgentArgs, SpawnLocalAgentResult } from '../shared/types'
import type { SpawnLocalAgentArgs, SpawnLocalAgentResult } from '../shared/types'
import { CLAUDE_MODELS, DEFAULT_MODEL } from '../shared/models'
import { getAgentBinary } from './settings'

function modelToFlag(model?: string): string {
  const entry = CLAUDE_MODELS.find((m) => m.id === model)
  return entry?.modelId ?? DEFAULT_MODEL.modelId
}

export async function spawnClaudeAgent(args: SpawnLocalAgentArgs): Promise<SpawnLocalAgentResult> {
  const bin = getAgentBinary()
  const id = randomUUID()

  // Create persistent agent record
  const meta = await createAgentRecord({
    id,
    pid: null,
    bin,
    model: modelToFlag(args.model),
    repo: pathBasename(args.repoPath),
    repoPath: args.repoPath,
    task: args.task,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    status: 'running',
    source: 'bde'
  })

  let handle: AgentHandle
  try {
    const provider = new SdkProvider()
    handle = await provider.spawn({
      prompt: args.task,
      workingDirectory: args.repoPath,
      model: args.model,
      agentId: id,
    })
  } catch (err) {
    console.error(`[local-agents] spawn failed for agent ${id}:`, err)
    await updateAgentMeta(id, {
      finishedAt: new Date().toISOString(),
      exitCode: null,
      status: 'failed'
    })
    return { pid: 0, logPath: meta.logPath, id, interactive: false }
  }

  const pid = handle.pid ?? 0

  // Track active handle
  if (pid) activeAgentProcesses.set(pid, handle)
  activeAgentsById.set(id, handle)

  // Update record with real PID
  await updateAgentMeta(id, { pid: pid || null })

  // Consume event stream in background for logging and completion
  consumeEvents(id, handle, meta.logPath).catch((err) => {
    console.error(`[agents] Event consumption failed for ${id}:`, err)
  })

  return { pid, logPath: meta.logPath, id, interactive: true }
}

/** Background event consumer — writes events to log and updates DB on completion. */
async function consumeEvents(id: string, handle: AgentHandle, logPath: string): Promise<void> {
  try {
    const bus = getEventBus()
    for await (const event of handle.events) {
      appendFile(logPath, JSON.stringify(event) + '\n', 'utf-8').catch((err) => {
        console.error(`[agents] Failed to write event to log ${logPath}:`, err)
      })
      bus.emit('agent:event', id, event)

      if (event.type === 'agent:completed') {
        activeAgentsById.delete(id)
        if (handle.pid) activeAgentProcesses.delete(handle.pid)
        const status = event.exitCode === 0 ? 'done' : 'failed'
        await updateAgentMeta(id, {
          finishedAt: new Date().toISOString(),
          exitCode: event.exitCode,
          status,
        })
        updateAgentRunCost(id, {
          costUsd: event.costUsd,
          tokensIn: event.tokensIn,
          tokensOut: event.tokensOut,
          cacheRead: 0,
          cacheCreate: 0,
          durationMs: event.durationMs,
          numTurns: 0,
        })
        break
      }
    }
  } catch (err) {
    console.error(`[agents] Event stream error for agent ${id}:`, err)
    activeAgentsById.delete(id)
    if (handle.pid) activeAgentProcesses.delete(handle.pid)
    await updateAgentMeta(id, {
      finishedAt: new Date().toISOString(),
      exitCode: null,
      status: 'failed',
    })
  }
}

// --- Kill a running agent by ID ---

export async function killAgent(agentId: string): Promise<{ ok: boolean; error?: string }> {
  const handle = activeAgentsById.get(agentId)
  if (!handle) {
    return { ok: false, error: `Agent ${agentId} not found — may have already exited` }
  }
  try {
    await handle.stop()
  } catch (err) {
    return { ok: false, error: `Failed to stop agent ${agentId}: ${(err as Error).message}` }
  }
  return { ok: true }
}

// --- Send follow-up message to a running interactive agent ---

export function sendToAgent(pid: number, message: string): { ok: boolean; error?: string } {
  const handle = activeAgentProcesses.get(pid)
  if (!handle) {
    return { ok: false, error: `Process ${pid} not found or stdin closed` }
  }
  handle.steer(message).catch((err) => {
    console.error(`[agents] Failed to steer PID ${pid}:`, err)
  })
  return { ok: true }
}

// --- Steer a running agent by agent ID (UUID) ---

export async function steerAgent(agentId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const handle = activeAgentsById.get(agentId)
  if (handle) {
    try {
      await handle.steer(message)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: `Failed to steer agent ${agentId}: ${(err as Error).message}` }
    }
  }

  return { ok: false, error: `Agent ${agentId} not found — may have already exited` }
}

// --- Check if a PID has an interactive agent handle ---

export function isAgentInteractive(pid: number): boolean {
  return activeAgentProcesses.has(pid)
}
