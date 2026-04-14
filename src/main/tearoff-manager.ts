/**
 * tearoff-manager.ts — Backward-compat re-export shim.
 *
 * All logic has been moved to focused modules:
 * - tearoff-window-manager.ts  (window lifecycle)
 * - tearoff-state-persistence.ts (bounds debounce)
 * - cross-window-drag-coordinator.ts (cursor polling, drag IPC)
 * - tearoff-handlers.ts (handler registration orchestrator)
 */

import {
  setQuitting,
  closeTearoffWindows,
  getMainWindow,
  SHARED_WEB_PREFERENCES,
  restoreTearoffWindows as _restoreTearoffWindows,
  _resetForTest as _resetWindowManager
} from './tearoff-window-manager'
import { registerTearoffHandlers, onPersistBounds } from './tearoff-handlers'
import {
  handleStartCrossWindowDrag,
  cancelActiveDrag,
  _resetForTest as _resetDrag
} from './cross-window-drag-coordinator'
import { _resetForTest as _resetPersistence } from './tearoff-state-persistence'

// ---------------------------------------------------------------------------
// Wrapped functions that supply internal callbacks
// ---------------------------------------------------------------------------

/** Recreates tear-off windows from persisted state (call after app is ready). */
function restoreTearoffWindows(): void {
  _restoreTearoffWindows(onPersistBounds)
}

/** FOR TESTING ONLY — resets all module-level state between test runs. */
function _resetForTest(): void {
  _resetWindowManager()
  _resetPersistence()
  _resetDrag()
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export {
  setQuitting,
  closeTearoffWindows,
  getMainWindow,
  restoreTearoffWindows,
  registerTearoffHandlers,
  SHARED_WEB_PREFERENCES,
  handleStartCrossWindowDrag,
  cancelActiveDrag,
  _resetForTest
}
