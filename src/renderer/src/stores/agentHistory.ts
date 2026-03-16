import { create } from 'zustand'
import type { AgentMeta } from '../../../preload/index.d'
import { createLogPollerActions, type LogPollerState } from '../lib/logPoller'

interface AgentHistoryState extends LogPollerState {
  agents: AgentMeta[]
  selectedId: string | null
  loading: boolean

  fetchAgents: () => Promise<void>
  selectAgent: (id: string | null) => void
  clearSelection: () => void
  startLogPolling: (id: string) => void
  stopLogPolling: () => void
  importExternal: (meta: Partial<AgentMeta>, content: string) => Promise<void>
}

export type { AgentMeta }

export const useAgentHistoryStore = create<AgentHistoryState>((set, get) => {
  const poller = createLogPollerActions(get, set)

  return {
    agents: [],
    selectedId: null,
    logContent: '',
    logNextByte: 0,
    loading: false,
    _logInterval: null,

    fetchAgents: async (): Promise<void> => {
      try {
        const agents = await window.api.agents.list({ limit: 100 })
        set({ agents })
      } catch {
        // Non-critical
      }
    },

    selectAgent: (id): void => {
      poller.stopLogPolling()
      set({
        selectedId: id,
        logContent: '',
        logNextByte: 0
      })
      if (id) {
        poller.startLogPolling((fromByte) =>
          window.api.agents.readLog({ id, fromByte })
        )
      }
    },

    clearSelection: (): void => {
      poller.stopLogPolling()
      set({
        selectedId: null,
        logContent: '',
        logNextByte: 0
      })
    },

    startLogPolling: (id): void => {
      poller.startLogPolling((fromByte) =>
        window.api.agents.readLog({ id, fromByte })
      )
    },

    stopLogPolling: poller.stopLogPolling,

    importExternal: async (meta, content): Promise<void> => {
      try {
        await window.api.agents.import({ meta, content })
        await get().fetchAgents()
      } catch {
        // Non-critical
      }
    }
  }
})
