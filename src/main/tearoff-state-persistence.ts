/**
 * tearoff-state-persistence.ts — Debounced bounds saving for tear-off windows.
 *
 * Owns: resize debounce timers and the 500ms debounce logic.
 * Receives a callback to invoke when bounds should be persisted — does NOT
 * own the persistence logic itself (caller provides that via callback).
 */

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const resizeTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** FOR TESTING ONLY — resets timer state between test runs. */
export function _resetForTest(): void {
  for (const timer of resizeTimers.values()) clearTimeout(timer)
  resizeTimers.clear()
}

/**
 * Schedules a debounced bounds persistence call for the given window.
 * Cancels any pending timer for the same windowId before scheduling a new one.
 * The provided `onPersist` callback is invoked after the 500ms debounce fires.
 */
export function scheduleBoundsUpdate(windowId: string, onPersist: () => void): void {
  const existing = resizeTimers.get(windowId)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    resizeTimers.delete(windowId)
    onPersist()
  }, 500)

  resizeTimers.set(windowId, timer)
}

/** Clears the pending resize timer for a window without firing the callback. */
export function clearResizeTimer(windowId: string): void {
  const timer = resizeTimers.get(windowId)
  if (timer) {
    clearTimeout(timer)
    resizeTimers.delete(windowId)
  }
}
