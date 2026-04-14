/**
 * Task status UI metadata — re-exports from the shared layer.
 *
 * STATUS_METADATA, BucketKey, and StatusMetadata now live in
 * src/shared/task-statuses.ts so that shared tests can reference them
 * without importing from the renderer layer. This file preserves backward-
 * compatible imports within the renderer.
 */

export type { BucketKey, StatusMetadata } from '../../../shared/task-statuses'
export { STATUS_METADATA } from '../../../shared/task-statuses'
