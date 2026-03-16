import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocalAgentsStore } from '../../stores/localAgents'
import { useAgentHistoryStore } from '../../stores/agentHistory'
import { cwdToRepoLabel } from './LocalAgentRow'
import { Button } from '../ui/Button'

function formatElapsed(startedAt: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return ''
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function classifyLine(line: string): string {
  const lower = line.toLowerCase()
  if (lower.includes('error') || lower.includes('failed') || lower.startsWith('!'))
    return 'agent-log__line--error'
  if (
    lower.includes('reading') ||
    lower.includes('read ') ||
    lower.includes('searching') ||
    lower.includes('grep')
  )
    return 'agent-log__line--read'
  if (
    lower.includes('writing') ||
    lower.includes('wrote') ||
    lower.includes('creating') ||
    lower.includes('edit')
  )
    return 'agent-log__line--write'
  return ''
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/** Log viewer for a history agent (by ID) */
export function AgentLogViewer({ agentId }: { agentId: string }): React.JSX.Element {
  const agents = useAgentHistoryStore((s) => s.agents)
  const logContent = useAgentHistoryStore((s) => s.logContent)
  const clearSelection = useAgentHistoryStore((s) => s.clearSelection)

  const agent = agents.find((a) => a.id === agentId) ?? null

  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [, setTick] = useState(0)

  const isRunning = agent?.status === 'running'

  // Tick for elapsed time
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isRunning])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logContent, autoScroll])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }, [])

  const handleResume = (): void => {
    setAutoScroll(true)
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const lines = logContent.split('\n')

  const elapsed = agent
    ? isRunning
      ? formatElapsed(new Date(agent.startedAt).getTime())
      : formatDuration(agent.startedAt, agent.finishedAt)
    : ''

  return (
    <div className="agent-log">
      <div className="agent-log__header">
        <div className="agent-log__header-left">
          <span className="agent-log__icon">{'\u2B21'}</span>
          <span className="agent-log__bin">{agent?.bin ?? 'claude'}</span>
          <span className="agent-log__repo">~/{agent?.repo ?? '?'}</span>
          <span className="agent-log__meta">{agent?.model ?? ''}</span>
          <span className="agent-log__meta">{agent ? formatTime(agent.startedAt) : ''}</span>
          {isRunning ? (
            <span className="agent-log__status agent-log__status--running">running</span>
          ) : agent?.status === 'failed' ? (
            <span className="agent-log__status agent-log__status--failed">{'\u2717'} Failed</span>
          ) : (
            <span className="agent-log__status agent-log__status--finished">{'\u25CF'} Finished</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelection}
          title="Close log viewer"
        >
          {'\u2715'}
        </Button>
      </div>
      {agent?.task && (
        <div className="agent-log__task-bar">
          <span className="agent-log__task-label">Task:</span>
          <span className="agent-log__task-text">{agent.task}</span>
        </div>
      )}
      <div className="agent-log__body" ref={scrollRef} onScroll={handleScroll}>
        {lines.map((line, i) => (
          <div key={i} className={`agent-log__line ${classifyLine(line)}`}>
            {line}
          </div>
        ))}
        {isRunning && <span className="agent-log__cursor">{'\u258B'}</span>}
      </div>
      {!isRunning && agent && (
        <div className={`agent-log__exit-bar ${agent.status === 'failed' ? 'agent-log__exit-bar--failed' : ''}`}>
          {agent.status === 'done'
            ? `\u25CF Finished \u2014 exit 0 \u00B7 ${elapsed}`
            : agent.status === 'failed'
              ? `\u2717 Failed \u2014 exit ${agent.exitCode ?? '?'} \u00B7 ${elapsed}`
              : `? Unknown \u2014 ${elapsed}`}
        </div>
      )}
      {!autoScroll && (
        <Button
          variant="ghost"
          size="sm"
          className="agent-log__resume"
          onClick={handleResume}
        >
          Resume auto-scroll
        </Button>
      )}
    </div>
  )
}

/** Log viewer for a live local agent (by PID) — legacy fallback */
export function LocalAgentLogViewer({ pid }: { pid: number }): React.JSX.Element {
  const processes = useLocalAgentsStore((s) => s.processes)
  const spawnedAgents = useLocalAgentsStore((s) => s.spawnedAgents)
  const logContent = useLocalAgentsStore((s) => s.logContent)
  const selectLocalAgent = useLocalAgentsStore((s) => s.selectLocalAgent)
  const startLogPolling = useLocalAgentsStore((s) => s.startLogPolling)
  const stopLogPolling = useLocalAgentsStore((s) => s.stopLogPolling)

  const proc = processes.find((p) => p.pid === pid)
  const spawned = spawnedAgents.find((a) => a.pid === pid)
  const isAlive = !!proc

  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [, setTick] = useState(0)

  // Tick for elapsed time
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Start polling the log file
  useEffect(() => {
    if (!spawned?.logPath) return
    startLogPolling(spawned.logPath)
    return () => stopLogPolling()
  }, [spawned?.logPath, startLogPolling, stopLogPolling])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logContent, autoScroll])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }, [])

  const handleResume = (): void => {
    setAutoScroll(true)
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const repoLabel = proc ? cwdToRepoLabel(proc.cwd) : spawned ? cwdToRepoLabel(spawned.repoPath) : '?'
  const elapsed = proc
    ? formatElapsed(proc.startedAt)
    : spawned
      ? formatElapsed(spawned.spawnedAt)
      : ''

  const lines = logContent.split('\n')

  return (
    <div className="agent-log">
      <div className="agent-log__header">
        <div className="agent-log__header-left">
          <span className="agent-log__icon">{'\u2B21'}</span>
          <span className="agent-log__bin">claude</span>
          <span className="agent-log__repo">~/{repoLabel}</span>
          <span className="agent-log__meta">pid {pid}</span>
          <span className="agent-log__meta">{elapsed}</span>
          {isAlive ? (
            <span className="agent-log__status agent-log__status--running">running</span>
          ) : (
            <span className="agent-log__status agent-log__status--finished">{'\u25CF'} Finished</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selectLocalAgent(null)}
          title="Close log viewer"
        >
          {'\u2715'}
        </Button>
      </div>
      <div className="agent-log__body" ref={scrollRef} onScroll={handleScroll}>
        {lines.map((line, i) => (
          <div key={i} className={`agent-log__line ${classifyLine(line)}`}>
            {line}
          </div>
        ))}
        {isAlive && <span className="agent-log__cursor">{'\u258B'}</span>}
      </div>
      {!autoScroll && (
        <Button
          variant="ghost"
          size="sm"
          className="agent-log__resume"
          onClick={handleResume}
        >
          Resume auto-scroll
        </Button>
      )}
    </div>
  )
}
