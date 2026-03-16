import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createLogPollerActions, type LogPollerState } from '../lib/logPoller'

export interface LocalAgentProcess {
  pid: number
  bin: string
  args: string
  cwd: string | null
  startedAt: number
  cpuPct: number
  memMb: number
}

export interface SpawnedAgent {
  id: string
  pid: number
  logPath: string
  task: string
  repoPath: string
  model: string
  spawnedAt: number
  interactive: boolean
}

interface LocalAgentsState extends LogPollerState {
  processes: LocalAgentProcess[]
  lastUpdated: number
  collapsed: boolean
  spawnedAgents: SpawnedAgent[]
  selectedLocalAgentPid: number | null

  fetchProcesses: () => Promise<void>
  setCollapsed: (collapsed: boolean) => void
  spawnAgent: (args: {
    task: string
    repoPath: string
    model?: string
  }) => Promise<{ pid: number; logPath: string; id: string }>
  sendToAgent: (pid: number, message: string) => Promise<void>
  killLocalAgent: (pid: number) => Promise<void>
  selectLocalAgent: (pid: number | null) => void
  startLogPolling: (logPath: string) => void
  stopLogPolling: () => void
}

export const useLocalAgentsStore = create<LocalAgentsState>()(
  persist(
    (set, get) => {
      const poller = createLogPollerActions(get, set)

      return {
        processes: [],
        lastUpdated: 0,
        collapsed: false,
        spawnedAgents: [],
        selectedLocalAgentPid: null,
        logContent: '',
        logNextByte: 0,
        _logInterval: null,

        fetchProcesses: async (): Promise<void> => {
          try {
            const procs = await window.api.getAgentProcesses()
            set({ processes: procs, lastUpdated: Date.now() })
          } catch {
            // Silently fail — local agents are non-critical
          }
        },

        setCollapsed: (collapsed): void => {
          set({ collapsed })
        },

        spawnAgent: async (args) => {
          const result = await window.api.spawnLocalAgent(args)
          set((s) => ({
            spawnedAgents: [
              ...s.spawnedAgents,
              {
                id: result.id,
                pid: result.pid,
                logPath: result.logPath,
                task: args.task,
                repoPath: args.repoPath,
                model: args.model ?? 'sonnet',
                spawnedAt: Date.now(),
                interactive: result.interactive ?? false
              }
            ]
          }))
          return result
        },

        sendToAgent: async (pid, message) => {
          const result = await window.api.sendToAgent(pid, message)
          if (!result.ok) {
            console.error('sendToAgent failed:', result.error)
          }
        },

        killLocalAgent: async (pid): Promise<void> => {
          await window.api.killLocalAgent(pid)
        },

        selectLocalAgent: (pid): void => {
          poller.stopLogPolling()
          set({
            selectedLocalAgentPid: pid,
            logContent: '',
            logNextByte: 0
          })
        },

        startLogPolling: (logPath): void => {
          poller.startLogPolling((fromByte) =>
            window.api.tailAgentLog({ logPath, fromByte })
          )
        },

        stopLogPolling: poller.stopLogPolling
      }
    },
    {
      name: 'bde-local-agents',
      partialize: (s) => ({ spawnedAgents: s.spawnedAgents })
    }
  )
)
