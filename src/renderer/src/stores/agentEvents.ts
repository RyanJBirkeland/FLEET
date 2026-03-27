import { create } from 'zustand'
import type { AgentEvent } from '../../../shared/types'

const MAX_EVENTS_PER_AGENT = 2000

interface AgentEventsState {
  events: Record<string, AgentEvent[]>
  init: () => () => void
  loadHistory: (agentId: string) => Promise<void>
  clear: (agentId: string) => void
}

export const useAgentEventsStore = create<AgentEventsState>((set) => ({
  events: {},

  init() {
    return window.api.agentEvents.onEvent(({ agentId, event }) => {
      set((state) => {
        const existing = state.events[agentId] ?? []
        const updated = [...existing, event]
        return {
          events: {
            ...state.events,
            [agentId]:
              updated.length > MAX_EVENTS_PER_AGENT
                ? updated.slice(-MAX_EVENTS_PER_AGENT)
                : updated
          }
        }
      })
    })
  },

  async loadHistory(agentId: string) {
    const history = await window.api.agentEvents.getHistory(agentId)
    set((state) => ({
      events: {
        ...state.events,
        [agentId]:
          history.length > MAX_EVENTS_PER_AGENT ? history.slice(-MAX_EVENTS_PER_AGENT) : history
      }
    }))
  },

  clear(agentId: string) {
    set((state) => {
      const next = { ...state.events }
      delete next[agentId]
      return { events: next }
    })
  }
}))
