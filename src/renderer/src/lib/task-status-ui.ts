/**
 * Task status UI metadata — presentation layer concerns for rendering task statuses.
 *
 * This module contains UI-specific metadata that was extracted from task-state-machine.ts
 * to maintain proper layer separation. Business logic stays in shared/, UI rendering
 * concerns live here in the renderer layer.
 *
 * Extracted as part of refactor to separate presentation from domain logic.
 */

import type { TaskStatus } from '../../../shared/task-state-machine'

/**
 * Bucket keys — the 7 UI partitions used by the sprint pipeline.
 * Derived from src/renderer/src/lib/partitionSprintTasks.ts.
 */
export type BucketKey =
  | 'backlog'
  | 'todo'
  | 'blocked'
  | 'inProgress'
  | 'awaitingReview'
  | 'done'
  | 'failed'

/**
 * Per-status UI metadata for rendering in the sprint pipeline.
 */
export interface StatusMetadata {
  /** Display label for the status */
  label: string
  /** Which UI bucket this status maps to */
  bucketKey: BucketKey
  /** CSS variable name for status color (e.g., "--bde-status-active") */
  colorToken: string
  /** lucide-react icon name for this status */
  iconName: string
  /** Can the user manually transition from this status via UI actions? */
  actionable: boolean
}

/**
 * Status metadata record — maps every TaskStatus to its UI rendering config.
 *
 * Sources:
 * - bucketKey: derived from partitionSprintTasks.ts
 * - colorToken: derived from task-format.ts getDotColor()
 * - iconName: inferred from UI patterns
 * - actionable: derived from TaskDetailActionButtons.tsx
 */
export const STATUS_METADATA: Readonly<Record<TaskStatus, StatusMetadata>> = {
  backlog: {
    label: 'Backlog',
    bucketKey: 'backlog',
    colorToken: '--bde-accent',
    iconName: 'Inbox',
    actionable: true
  },
  queued: {
    label: 'Queued',
    bucketKey: 'todo',
    colorToken: '--bde-accent',
    iconName: 'Clock',
    actionable: true
  },
  blocked: {
    label: 'Blocked',
    bucketKey: 'blocked',
    colorToken: '--bde-warning',
    iconName: 'AlertCircle',
    actionable: true
  },
  active: {
    label: 'In Progress',
    bucketKey: 'inProgress',
    colorToken: '--bde-status-active',
    iconName: 'Play',
    actionable: false
  },
  review: {
    label: 'Awaiting Review',
    bucketKey: 'awaitingReview',
    colorToken: '--bde-status-review',
    iconName: 'Eye',
    actionable: true
  },
  done: {
    label: 'Done',
    bucketKey: 'done',
    colorToken: '--bde-status-done',
    iconName: 'CheckCircle',
    actionable: false
  },
  cancelled: {
    label: 'Cancelled',
    bucketKey: 'failed',
    colorToken: '--bde-danger',
    iconName: 'Slash',
    actionable: false
  },
  failed: {
    label: 'Failed',
    bucketKey: 'failed',
    colorToken: '--bde-danger',
    iconName: 'XCircle',
    actionable: true
  },
  error: {
    label: 'Error',
    bucketKey: 'failed',
    colorToken: '--bde-danger',
    iconName: 'AlertTriangle',
    actionable: true
  }
}
