import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '../ui/Button'
import { KanbanBoard } from './KanbanBoard'
import { SpecDrawer } from './SpecDrawer'
import { PRSection } from './PRSection'
import { toast } from '../../stores/toasts'
import { POLL_SPRINT_INTERVAL, REPO_OPTIONS } from '../../lib/constants'
import type { AgentMeta } from '../../../../shared/types'

// --- Types ---

export interface SprintTask {
  id: string
  title: string
  repo: string
  priority: number
  status: 'backlog' | 'active' | 'done'
  description: string | null
  spec: string | null
  agent_session_id: string | null
  pr_number: number | null
  pr_status: 'open' | 'merged' | 'closed' | 'draft' | null
  pr_url: string | null
  column_order: number
  started_at: string | null
  completed_at: string | null
  updated_at: string
  created_at: string
  source: 'queue' | 'live' | 'history'
}

interface QueueTask {
  id: string
  title: string
  branch?: string
  worktree?: string
  domain?: string
  status: 'queued' | 'done' | 'pr_open' | 'merged'
  spec?: string
  description?: string
  pr?: number
  merged?: boolean
  repo?: string
  priority?: number
  column_order?: number
  created_at?: string
}

interface AgentProcess {
  pid: number
  bin: string
  args: string
  cwd: string | null
  startedAt: number
  cpuPct: number
  memMb: number
}

// --- Helpers ---

const QUEUE_PATH = 'projects/bde-agent-queue.json'

function deriveRepo(qt: QueueTask): string {
  if (qt.repo) return qt.repo
  if (qt.domain) return qt.domain
  if (qt.branch) {
    for (const r of REPO_OPTIONS) {
      if (qt.branch.toLowerCase().includes(r.label.toLowerCase())) return r.label
    }
  }
  return 'BDE'
}

function deriveRepoFromPath(cwd: string | null): string {
  if (!cwd) return 'BDE'
  const lower = cwd.toLowerCase()
  for (const r of REPO_OPTIONS) {
    if (lower.includes(r.label.toLowerCase())) return r.label
  }
  return 'BDE'
}

function mapQueueTask(qt: QueueTask): SprintTask {
  const isDone = qt.status === 'done' || qt.status === 'merged' || qt.status === 'pr_open'
  return {
    id: qt.id,
    title: qt.title,
    repo: deriveRepo(qt),
    priority: qt.priority ?? 0,
    status: isDone ? 'done' : 'backlog',
    description: qt.description ?? null,
    spec: qt.spec ?? null,
    agent_session_id: null,
    pr_number: qt.pr ?? null,
    pr_status: qt.merged ? 'merged' : qt.pr ? 'open' : null,
    pr_url: qt.pr ? `https://github.com/RyanJBirkeland/${deriveRepo(qt)}/pull/${qt.pr}` : null,
    column_order: qt.column_order ?? 0,
    started_at: null,
    completed_at: isDone ? (qt.created_at ?? new Date().toISOString()) : null,
    updated_at: qt.created_at ?? new Date().toISOString(),
    created_at: qt.created_at ?? new Date().toISOString(),
    source: 'queue',
  }
}

function mapLiveProcess(proc: AgentProcess, queueMatch?: QueueTask): SprintTask {
  const taskText = proc.args.split('--task ')?.[1]?.split(' --')?.[0] ?? proc.args
  return {
    id: `live-${proc.pid}`,
    title: queueMatch?.title ?? taskText.slice(0, 100),
    repo: deriveRepoFromPath(proc.cwd),
    priority: 0,
    status: 'active',
    description: null,
    spec: queueMatch?.spec ?? null,
    agent_session_id: String(proc.pid),
    pr_number: queueMatch?.pr ?? null,
    pr_status: null,
    pr_url: null,
    column_order: 0,
    started_at: new Date(proc.startedAt).toISOString(),
    completed_at: null,
    updated_at: new Date(proc.startedAt).toISOString(),
    created_at: new Date(proc.startedAt).toISOString(),
    source: 'live',
  }
}

function mapAgentHistory(agent: AgentMeta): SprintTask {
  return {
    id: `hist-${agent.id}`,
    title: agent.task,
    repo: agent.repo || deriveRepoFromPath(agent.repoPath),
    priority: 0,
    status: agent.status === 'running' ? 'active' : 'done',
    description: null,
    spec: null,
    agent_session_id: agent.id,
    pr_number: null,
    pr_status: null,
    pr_url: null,
    column_order: 0,
    started_at: agent.startedAt,
    completed_at: agent.finishedAt,
    updated_at: agent.finishedAt ?? agent.startedAt,
    created_at: agent.startedAt,
    source: 'history',
  }
}

function mergeTaskSources(
  queueTasks: QueueTask[],
  liveProcesses: AgentProcess[],
  agentHistory: AgentMeta[]
): SprintTask[] {
  const seen = new Set<string>()
  const tasks: SprintTask[] = []

  const add = (t: SprintTask) => {
    if (seen.has(t.id)) return
    seen.add(t.id)
    tasks.push(t)
  }

  // 1. Queue items (backlog + done)
  for (const qt of queueTasks) {
    add(mapQueueTask(qt))
  }

  // 2. Live processes → In Progress
  for (const proc of liveProcesses) {
    const queueMatch = queueTasks.find(
      (qt) => qt.branch && proc.cwd?.includes(qt.branch)
    )
    add(mapLiveProcess(proc, queueMatch))
  }

  // 3. Done from agent history (only completed, non-running)
  const recentHistory = agentHistory
    .filter((a) => a.status === 'done' && a.exitCode === 0)
    .slice(0, 20)
  for (const agent of recentHistory) {
    add(mapAgentHistory(agent))
  }

  return tasks
}

// --- Component ---

export default function SprintCenter() {
  const [tasks, setTasks] = useState<SprintTask[]>([])
  const [repoFilter, setRepoFilter] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<SprintTask | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queueRef = useRef<QueueTask[]>([])

  const loadData = useCallback(async () => {
    try {
      // Fetch all three sources in parallel
      const [queueRaw, liveProcesses, agentHistory] = await Promise.all([
        window.api.readMemoryFile(QUEUE_PATH).catch(() => '{"tasks":[]}'),
        window.api.getAgentProcesses().catch(() => [] as AgentProcess[]),
        window.api.agents.list({ limit: 50 }).catch(() => [] as AgentMeta[]),
      ])

      let queueTasks: QueueTask[] = []
      try {
        const parsed = JSON.parse(queueRaw)
        queueTasks = Array.isArray(parsed.tasks) ? parsed.tasks : Array.isArray(parsed) ? parsed : []
      } catch {
        queueTasks = []
      }

      queueRef.current = queueTasks
      const merged = mergeTaskSources(queueTasks, liveProcesses, agentHistory)
      setTasks(merged)
    } catch {
      // silent — data will be empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    intervalRef.current = setInterval(loadData, POLL_SPRINT_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [loadData])

  const writeQueue = useCallback(async (updatedQueue: QueueTask[]) => {
    queueRef.current = updatedQueue
    await window.api.writeMemoryFile(QUEUE_PATH, JSON.stringify({ tasks: updatedQueue }, null, 2))
  }, [])

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<SprintTask>) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...patch, updated_at: new Date().toISOString() } : t))
      )

      // Update selected task if open
      setSelectedTask((prev) =>
        prev?.id === taskId ? { ...prev, ...patch, updated_at: new Date().toISOString() } : prev
      )

      // Write back to queue for queue-sourced tasks
      const updated = queueRef.current.map((qt) => {
        if (qt.id !== taskId) return qt
        const newQt = { ...qt }
        if (patch.status === 'backlog') newQt.status = 'queued'
        if (patch.status === 'done') newQt.status = 'done'
        if (patch.spec !== undefined) newQt.spec = patch.spec ?? undefined
        if (patch.description !== undefined) newQt.description = patch.description ?? undefined
        if (patch.pr_number !== undefined) newQt.pr = patch.pr_number ?? undefined
        return newQt
      })
      await writeQueue(updated)
    },
    [writeQueue]
  )

  const createTask = useCallback(
    async (data: { title: string; repo: string; description: string }) => {
      const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const now = new Date().toISOString()
      const newTask: SprintTask = {
        id,
        title: data.title,
        repo: data.repo,
        priority: 0,
        status: 'backlog',
        description: data.description || null,
        spec: null,
        agent_session_id: null,
        pr_number: null,
        pr_status: null,
        pr_url: null,
        column_order: tasks.filter((t) => t.status === 'backlog').length,
        started_at: null,
        completed_at: null,
        updated_at: now,
        created_at: now,
        source: 'queue',
      }

      // Optimistic
      setTasks((prev) => [...prev, newTask])

      // Write to queue
      const queueTask: QueueTask = {
        id,
        title: data.title,
        repo: data.repo,
        status: 'queued',
        description: data.description || undefined,
        created_at: now,
      }
      await writeQueue([...queueRef.current, queueTask])
      toast.success('Card added')
    },
    [tasks, writeQueue]
  )

  const handleDragEnd = useCallback(
    (taskId: string, newStatus: SprintTask['status']) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task || task.status === newStatus) return
      updateTask(taskId, { status: newStatus })
    },
    [tasks, updateTask]
  )

  const handleLaunch = useCallback(
    async (task: SprintTask) => {
      try {
        const repoPaths = await window.api.getRepoPaths()
        const repoPath = repoPaths[task.repo.toLowerCase()] ?? repoPaths[task.repo]
        if (!repoPath) {
          toast.error(`No repo path configured for "${task.repo}"`)
          return
        }

        const result = await window.api.spawnLocalAgent({
          task: task.spec ?? task.title,
          repoPath,
        })

        updateTask(task.id, {
          status: 'active',
          agent_session_id: result.id,
          started_at: new Date().toISOString(),
        })
        toast.success('Agent launched')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to launch agent')
      }
    },
    [updateTask]
  )

  const handleSaveSpec = useCallback(
    (taskId: string, spec: string) => {
      updateTask(taskId, { spec })
    },
    [updateTask]
  )

  const handleViewOutput = useCallback((task: SprintTask) => {
    if (task.agent_session_id) {
      // Navigate to sessions view — dispatch custom event
      window.dispatchEvent(
        new CustomEvent('bde:navigate', { detail: { view: 'sessions', sessionId: task.agent_session_id } })
      )
    }
  }, [])

  const filteredTasks = repoFilter
    ? tasks.filter((t) => t.repo.toLowerCase() === repoFilter.toLowerCase())
    : tasks

  return (
    <div className="sprint-center">
      <div className="sprint-center__header">
        <div className="sprint-center__title-row">
          <span className="sprint-center__title">Sprint Center</span>
          <div className="sprint-board__repo-switcher">
            {REPO_OPTIONS.map((r) => (
              <button
                key={r.label}
                onClick={() => setRepoFilter(repoFilter === r.label ? null : r.label)}
                className={`sprint-board__repo-chip ${repoFilter === r.label ? 'sprint-board__repo-chip--active' : ''}`}
                style={repoFilter === r.label ? { borderColor: r.color, color: r.color } : undefined}
              >
                <span className="sprint-board__repo-dot" style={{ background: r.color }} />
                {r.label}
              </button>
            ))}
            <button
              onClick={() => setRepoFilter(null)}
              className={`sprint-board__repo-chip ${repoFilter === null ? 'sprint-board__repo-chip--active' : ''}`}
            >
              All
            </button>
          </div>
        </div>
        <div className="sprint-center__actions">
          <Button variant="icon" size="sm" onClick={loadData} disabled={loading} title="Refresh">
            &#x21bb;
          </Button>
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="sprint-board__loading" style={{ padding: 16 }}>
          <div className="sprint-board__skeleton" />
          <div className="sprint-board__skeleton" />
          <div className="sprint-board__skeleton" />
        </div>
      ) : (
        <KanbanBoard
          tasks={filteredTasks}
          onDragEnd={handleDragEnd}
          onLaunch={handleLaunch}
          onViewSpec={setSelectedTask}
          onViewOutput={handleViewOutput}
          onAddCard={createTask}
        />
      )}

      <PRSection />

      <SpecDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSave={handleSaveSpec}
        onLaunch={handleLaunch}
      />
    </div>
  )
}
