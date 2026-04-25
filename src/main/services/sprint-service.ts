/**
 * Sprint service — backward-compatible unified interface.
 *
 * This module is a barrel re-export. It exists to keep existing import paths
 * working without changes. New code should import from the focused modules:
 *
 * - Data / mutations:  `sprint-mutations.ts`
 * - Notifications:     `sprint-mutation-broadcaster.ts`
 * - Orchestration:     `sprint-use-cases.ts`
 *
 * The broadcaster-wrapped mutation wrappers (`createTask`, `updateTask`, etc.)
 * still live here because they combine two concerns that callers currently
 * treat as a single operation. They may be moved to `sprint-use-cases.ts`
 * in a future cleanup.
 */
import * as mutations from './sprint-mutations'
import * as broadcaster from './sprint-mutation-broadcaster'
import type { SprintTask } from '../../shared/types'

export type {
  CreateTaskInput,
  QueueStats,
  SpecTypeSuccessRate,
  DailySuccessRate,
  ListTasksOptions,
  UpdateTaskOptions
} from './sprint-mutations'

export type { SprintMutationEvent, SprintMutationListener } from './sprint-mutation-broadcaster'

// Re-export notification functions
export const onSprintMutation = broadcaster.onSprintMutation
export const notifySprintMutation = broadcaster.notifySprintMutation

// Re-export read-only operations
export const getTask = mutations.getTask
export const listTasks = mutations.listTasks
// Audit trail read — exposed through the service layer so adapters (MCP,
// handlers) never reach past it into the data layer directly.
export { getTaskChanges } from '../data/task-changes'
export type { TaskChange, GetTaskChangesOptions } from '../data/task-changes'
export const listTasksRecent = mutations.listTasksRecent
export const getQueueStats = mutations.getQueueStats
export const getDoneTodayCount = mutations.getDoneTodayCount
export const listTasksWithOpenPrs = mutations.listTasksWithOpenPrs
export const getHealthCheckTasks = mutations.getHealthCheckTasks
export const getSuccessRateBySpecType = mutations.getSuccessRateBySpecType
export const getDailySuccessRate = mutations.getDailySuccessRate
export const markTaskDoneByPrNumber = mutations.markTaskDoneByPrNumber
export const markTaskCancelledByPrNumber = mutations.markTaskCancelledByPrNumber
export const updateTaskMergeableState = mutations.updateTaskMergeableState
export const flagStuckTasks = mutations.flagStuckTasks

// Wrap mutation operations to auto-notify
export function createTask(input: mutations.CreateTaskInput): SprintTask | null {
  const row = mutations.createTask(input)
  if (row) broadcaster.notifySprintMutation('created', row)
  return row
}

export function claimTask(id: string, claimedBy: string): SprintTask | null {
  const result = mutations.claimTask(id, claimedBy)
  if (result) broadcaster.notifySprintMutation('updated', result)
  return result
}

export function updateTask(
  id: string,
  patch: Record<string, unknown>,
  options?: mutations.UpdateTaskOptions
): SprintTask | null {
  const result = mutations.updateTask(id, patch, options)
  if (result) broadcaster.notifySprintMutation('updated', result)
  return result
}

/**
 * Manual operator override — writes a terminal status bypassing the state machine.
 * See `forceUpdateTask` in sprint-task-crud for rationale.
 */
export function forceUpdateTask(id: string, patch: Record<string, unknown>): SprintTask | null {
  const result = mutations.forceUpdateTask(id, patch)
  if (result) broadcaster.notifySprintMutation('updated', result)
  return result
}

export function deleteTask(id: string): void {
  const task = mutations.getTask(id)
  mutations.deleteTask(id)
  if (task) broadcaster.notifySprintMutation('deleted', task)
}

export function releaseTask(id: string, claimedBy: string): SprintTask | null {
  const result = mutations.releaseTask(id, claimedBy)
  if (result) broadcaster.notifySprintMutation('updated', result)
  return result
}

export function createReviewTaskFromAdhoc(input: {
  title: string
  repo: string
  spec: string
  worktreePath: string
  branch: string
}): SprintTask | null {
  const row = mutations.createReviewTaskFromAdhoc(input)
  if (row) broadcaster.notifySprintMutation('created', row)
  return row
}

// Re-export use-case orchestration from the focused module.
export {
  cancelTask,
  resetTaskForRetry,
  updateTaskFromUi,
  TaskTransitionError,
  TaskValidationError,
} from './sprint-use-cases'

export type {
  CancelTaskDeps,
  CancelTaskOptions,
  ResetTaskForRetryDeps,
  CreateTaskWithValidationDeps,
  CreateTaskWithValidationOpts,
  UpdateTaskFromUiDeps,
  TaskValidationCode,
} from './sprint-use-cases'

import {
  createTaskWithValidation as _createTaskWithValidation,
  type CreateTaskWithValidationDeps,
  type CreateTaskWithValidationOpts,
} from './sprint-use-cases'

/**
 * Broadcaster-wired variant of `createTaskWithValidation`. Injects the
 * broadcaster-wrapped `createTask` so the renderer is notified on success.
 * Callers that need raw (no-broadcast) creation should use
 * `sprint-use-cases.createTaskWithValidation` directly with an explicit dep.
 */
export function createTaskWithValidation(
  input: mutations.CreateTaskInput,
  deps: CreateTaskWithValidationDeps,
  opts?: CreateTaskWithValidationOpts
): SprintTask {
  return _createTaskWithValidation(input, { ...deps, createTask }, opts)
}
