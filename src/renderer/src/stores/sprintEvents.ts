import { create } from 'zustand'
import type { TaskOutputEvent } from '../../../shared/queue-api-contract'
import type { AgentEvent } from '../../../main/agents/types'

/** Union of both event sources during dual-write migration. */
export type AnyTaskEvent = TaskOutputEvent | AgentEvent

interface SprintEventsState {
  // --- State ---
  taskEvents: Record<string, AnyTaskEvent[]>
  latestEvents: Record<string, AnyTaskEvent>

  // --- Actions ---
  initTaskOutputListener: () => () => void
  clearTaskEvents: (taskId: string) => void
}

export const useSprintEvents = create<SprintEventsState>((set) => ({
  taskEvents: {},
  latestEvents: {},

  initTaskOutputListener: (): (() => void) => {
    // Legacy path: task:output events from queue API
    const cleanupLegacy = window.api.onTaskOutput(({ taskId, events }) => {
      set((s) => {
        const existing = s.taskEvents[taskId] ?? []
        const updated = [...existing, ...events]
        const latest = events[events.length - 1]
        return {
          taskEvents: { ...s.taskEvents, [taskId]: updated },
          latestEvents: { ...s.latestEvents, [taskId]: latest },
        }
      })
    })

    // Phase 2 dual-write: agent:event stream populates legacy fields
    const cleanupAgent = window.api.agentEvents?.onEvent(({ agentId, event }) => {
      set((s) => ({
        taskEvents: {
          ...s.taskEvents,
          [agentId]: [...(s.taskEvents[agentId] ?? []), event],
        },
        latestEvents: {
          ...s.latestEvents,
          [agentId]: event,
        },
      }))
    })

    return () => {
      cleanupLegacy()
      cleanupAgent?.()
    }
  },

  clearTaskEvents: (taskId): void => {
    set((s) => {
      const { [taskId]: _events, ...restEvents } = s.taskEvents
      const { [taskId]: _latest, ...restLatest } = s.latestEvents
      return { taskEvents: restEvents, latestEvents: restLatest }
    })
  },
}))
