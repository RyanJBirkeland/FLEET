/**
 * Agent process scanner — discovers running AI agent processes by scanning
 * `ps` output for known agent binaries and resolving working directories
 * via `lsof` on macOS.
 *
 * Extracted from local-agents.ts to keep that module focused on spawn/kill/steer.
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import { listAgents } from './agent-history'
import { updateAgentMeta } from './agent-history'

const execFileAsync = promisify(execFile)

export const KNOWN_AGENT_BINS = ['claude', 'codex', 'opencode', 'pi', 'aider', 'cursor']

export interface LocalAgentProcess {
  pid: number
  bin: string
  args: string
  cwd: string | null
  startedAt: number
  cpuPct: number
  memMb: number
}

export interface PsCandidate {
  pid: number
  cpuPct: number
  rss: number
  elapsed: string
  command: string
  bin: string
}

// CWD doesn't change for a given PID — cache it
const cwdCache = new Map<number, string | null>()

export async function getProcessCwd(pid: number): Promise<string | null> {
  if (cwdCache.has(pid)) return cwdCache.get(pid)!
  try {
    const { stdout } = await execFileAsync('lsof', ['-p', String(pid), '-a', '-d', 'cwd', '-F', 'n'])
    const lines = stdout.split('\n')
    const nLine = lines.find((l) => l.startsWith('n') && l !== 'ncwd')
    const cwd = nLine ? nLine.slice(1) : null
    cwdCache.set(pid, cwd)
    return cwd
  } catch {
    cwdCache.set(pid, null)
    return null
  }
}

function parseElapsedToMs(elapsed: string): number {
  // etime format: [[DD-]HH:]MM:SS
  const trimmed = elapsed.trim()
  const dayParts = trimmed.split('-')
  let days = 0
  let timePart = trimmed
  if (dayParts.length === 2) {
    days = parseInt(dayParts[0])
    timePart = dayParts[1]
  }
  const segments = timePart.split(':').map((s) => parseInt(s))
  let seconds = 0
  if (segments.length === 3) {
    seconds = segments[0] * 3600 + segments[1] * 60 + segments[2]
  } else if (segments.length === 2) {
    seconds = segments[0] * 60 + segments[1]
  } else if (segments.length === 1) {
    seconds = segments[0]
  }
  return (days * 86400 + seconds) * 1000
}

function matchAgentBin(command: string): string | null {
  const parts = command.split(/\s+/)
  // Only check the first token (the executable itself)
  const execPath = parts[0] ?? ''
  // Exclude macOS .app bundles (e.g. Claude.app, Cursor.app) — we only want CLI tools
  if (execPath.includes('.app/Contents')) return null
  const binName = (execPath.split('/').pop() ?? '').toLowerCase()
  return KNOWN_AGENT_BINS.find((b) => binName === b) ?? null
}

export async function scanAgentProcesses(): Promise<PsCandidate[]> {
  const { stdout } = await execFileAsync('ps', ['-eo', 'pid,%cpu,rss,etime,args'])
  const lines = stdout.trim().split('\n').slice(1)
  const candidates: PsCandidate[] = []
  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(.+)$/)
    if (!match) continue
    const bin = matchAgentBin(match[5]!)
    if (!bin) continue
    candidates.push({
      pid: parseInt(match[1]!),
      cpuPct: parseFloat(match[2]!),
      rss: parseInt(match[3]!),
      elapsed: match[4]!,
      command: match[5]!,
      bin
    })
  }
  return candidates
}

export async function resolveProcessDetails(candidates: PsCandidate[]): Promise<LocalAgentProcess[]> {
  return Promise.all(
    candidates.map(async (c) => {
      const cwd = await getProcessCwd(c.pid)
      const args = c.command.split(/\s+/).slice(1).join(' ')
      return {
        pid: c.pid,
        bin: c.bin,
        args,
        cwd,
        startedAt: Date.now() - parseElapsedToMs(c.elapsed),
        cpuPct: c.cpuPct,
        memMb: Math.round(c.rss / 1024)
      }
    })
  )
}

export function evictStaleCwdCache(livePids: Set<number>): void {
  for (const pid of cwdCache.keys()) {
    if (!livePids.has(pid)) cwdCache.delete(pid)
  }
}

export async function reconcileStaleAgents(livePids: Set<number>): Promise<void> {
  const running = await listAgents(500, 'running')
  for (const agent of running) {
    if (agent.pid && !livePids.has(agent.pid)) {
      await updateAgentMeta(agent.id, {
        finishedAt: new Date().toISOString(),
        status: 'unknown',
        exitCode: null
      })
    }
  }
}

const RECONCILE_INTERVAL_MS = 30_000
let _lastReconcileAt = 0

async function maybeReconcileStaleAgents(livePids: Set<number>): Promise<void> {
  const now = Date.now()
  if (now - _lastReconcileAt < RECONCILE_INTERVAL_MS) return
  _lastReconcileAt = now
  await reconcileStaleAgents(livePids)
}

/** @internal — reset throttle state for testing only */
export function _resetReconcileThrottle(): void {
  _lastReconcileAt = 0
}

// Full result cache — avoids repeated ps + lsof on every poll
let _processCache: LocalAgentProcess[] = []
let _processCachedAt = 0
const PROCESS_CACHE_TTL = 5_000

/** @internal — reset process cache for testing only */
export function _resetProcessCache(): void {
  _processCache = []
  _processCachedAt = 0
}

export async function getAgentProcesses(): Promise<LocalAgentProcess[]> {
  const now = Date.now()
  if (now - _processCachedAt < PROCESS_CACHE_TTL) {
    return _processCache
  }

  try {
    const candidates = await scanAgentProcesses()
    const results = await resolveProcessDetails(candidates)
    const livePids = new Set(results.map((r) => r.pid))

    evictStaleCwdCache(livePids)
    maybeReconcileStaleAgents(livePids).catch(() => {})

    _processCache = results
    _processCachedAt = now
    return results
  } catch {
    return _processCache
  }
}
