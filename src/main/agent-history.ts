/**
 * Agent history — persistent storage for agent metadata and logs.
 * Stores records in ~/.bde/agents.json and log files in ~/.bde/agent-logs/{date}/{id}/.
 */
import { mkdir, readFile, writeFile, appendFile, rm, readdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'
import type { AgentMeta } from '../shared/types'

export type { AgentMeta }

const BDE_DIR = join(homedir(), '.bde')
const AGENTS_INDEX = join(BDE_DIR, 'agents.json')
const LOGS_DIR = join(BDE_DIR, 'agent-logs')

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

async function readIndex(): Promise<AgentMeta[]> {
  try {
    const raw = await readFile(AGENTS_INDEX, 'utf-8')
    return JSON.parse(raw) as AgentMeta[]
  } catch {
    return []
  }
}

async function writeIndex(agents: AgentMeta[]): Promise<void> {
  await ensureDir(BDE_DIR)
  await writeFile(AGENTS_INDEX, JSON.stringify(agents, null, 2), 'utf-8')
}

function datePrefix(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

export async function listAgents(limit = 100, status?: string): Promise<AgentMeta[]> {
  const all = await readIndex()
  const filtered = status ? all.filter((a) => a.status === status) : all
  return filtered.slice(0, limit)
}

export async function createAgentRecord(
  meta: Omit<AgentMeta, 'logPath'>
): Promise<AgentMeta> {
  const date = datePrefix(meta.startedAt)
  const logDir = join(LOGS_DIR, date, meta.id)
  await ensureDir(logDir)

  const logPath = join(logDir, 'output.log')
  // Create empty log file
  await writeFile(logPath, '', 'utf-8')
  // Write meta.json
  const full: AgentMeta = { ...meta, logPath }
  await writeFile(join(logDir, 'meta.json'), JSON.stringify(full, null, 2), 'utf-8')

  // Prepend to index
  const index = await readIndex()
  index.unshift(full)
  await writeIndex(index)

  return full
}

export async function appendLog(id: string, content: string): Promise<void> {
  const index = await readIndex()
  const agent = index.find((a) => a.id === id)
  if (!agent) return
  await appendFile(agent.logPath, content, 'utf-8')
}

export async function readLog(
  id: string,
  fromByte = 0
): Promise<{ content: string; nextByte: number }> {
  const index = await readIndex()
  const agent = index.find((a) => a.id === id)
  if (!agent) return { content: '', nextByte: fromByte }
  try {
    const buf = await readFile(agent.logPath)
    const slice = buf.subarray(fromByte)
    return { content: slice.toString('utf-8'), nextByte: buf.length }
  } catch {
    return { content: '', nextByte: fromByte }
  }
}

export async function getAgentMeta(id: string): Promise<AgentMeta | null> {
  const index = await readIndex()
  return index.find((a) => a.id === id) ?? null
}

export async function updateAgentMeta(
  id: string,
  patch: Partial<AgentMeta>
): Promise<void> {
  const index = await readIndex()
  const idx = index.findIndex((a) => a.id === id)
  if (idx === -1) return
  Object.assign(index[idx], patch)
  await writeIndex(index)

  // Also update the per-agent meta.json
  const agent = index[idx]
  const date = datePrefix(agent.startedAt)
  const metaPath = join(LOGS_DIR, date, agent.id, 'meta.json')
  try {
    await writeFile(metaPath, JSON.stringify(agent, null, 2), 'utf-8')
  } catch {
    // Log dir may not exist for imported agents
  }
}

export async function importAgent(
  meta: Partial<AgentMeta>,
  content: string
): Promise<AgentMeta> {
  const id = meta.id ?? randomUUID()
  const startedAt = meta.startedAt ?? new Date().toISOString()
  const full: Omit<AgentMeta, 'logPath'> = {
    id,
    pid: meta.pid ?? null,
    bin: meta.bin ?? 'claude',
    model: meta.model ?? 'unknown',
    repo: meta.repo ?? 'unknown',
    repoPath: meta.repoPath ?? '',
    task: meta.task ?? '',
    startedAt,
    finishedAt: meta.finishedAt ?? null,
    exitCode: meta.exitCode ?? null,
    status: meta.status ?? 'unknown',
    source: meta.source ?? 'external'
  }
  const record = await createAgentRecord(full)
  if (content) {
    await appendLog(id, content)
  }
  return record
}

export async function pruneOldAgents(maxCount = 500): Promise<void> {
  const index = await readIndex()
  if (index.length <= maxCount) return

  const kept = index.slice(0, maxCount)
  const removed = index.slice(maxCount)
  await writeIndex(kept)

  // Clean up log directories for pruned agents
  for (const agent of removed) {
    const date = datePrefix(agent.startedAt)
    const logDir = join(LOGS_DIR, date, agent.id)
    try {
      await rm(logDir, { recursive: true, force: true })
    } catch {
      // Already gone
    }
  }

  // Clean up empty date directories
  try {
    const dateDirs = await readdir(LOGS_DIR)
    for (const d of dateDirs) {
      const dirPath = join(LOGS_DIR, d)
      try {
        const entries = await readdir(dirPath)
        if (entries.length === 0) {
          await rm(dirPath, { recursive: true, force: true })
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // Logs dir may not exist
  }
}

/** Check if an agent ID exists in the index */
export async function hasAgent(id: string): Promise<boolean> {
  const index = await readIndex()
  return index.some((a) => a.id === id)
}

/** Find agent by PID (for matching live processes to history) */
export async function findAgentByPid(pid: number): Promise<AgentMeta | null> {
  const index = await readIndex()
  return index.find((a) => a.pid === pid && a.status === 'running') ?? null
}
