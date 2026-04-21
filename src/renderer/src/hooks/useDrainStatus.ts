import { useEffect, useState } from 'react'

export interface DrainPausedState {
  reason: string
  pausedUntil: number
  affectedTaskCount: number
}

/**
 * Subscribes to drain-paused events emitted when the agent manager detects an
 * environmental failure and suspends the drain loop. Returns the current pause
 * state, or null when no pause is active. Auto-clears when `pausedUntil` elapses.
 */
export function useDrainStatus(): DrainPausedState | null {
  const [state, setState] = useState<DrainPausedState | null>(null)

  useEffect(() => {
    return window.api.agentManager.onDrainPaused((event) => {
      setState(event)
    })
  }, [])

  useEffect(() => {
    if (!state) return
    const remainingMs = Math.max(0, state.pausedUntil - Date.now())
    const timer = setTimeout(() => setState(null), remainingMs)
    return () => clearTimeout(timer)
  }, [state])

  return state
}
