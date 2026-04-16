/**
 * View type — extracted to break the panelLayout ↔ view-registry cycle.
 * Import this file, not stores/panelLayout, when you only need the View union.
 */
export type View =
  | 'dashboard'
  | 'agents'
  | 'ide'
  | 'sprint'
  | 'code-review'
  | 'git'
  | 'settings'
  | 'planner'

export type DropZone = 'top' | 'bottom' | 'left' | 'right' | 'center'
