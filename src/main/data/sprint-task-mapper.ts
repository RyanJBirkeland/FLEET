import type { SprintTask } from '../../shared/types'
import { sanitizeDependsOn } from '../../shared/sanitize-depends-on'
import { sanitizeTags } from '../../shared/sanitize-tags'

/**
 * Sanitize a single task row from SQLite.
 * - Coerces INTEGER 0/1 to boolean for playground_enabled, needs_review
 * - Deserializes depends_on from JSON string
 * - Deserializes tags from JSON string
 */
export function mapRowToTask(row: Record<string, unknown>): SprintTask {
  let revisionFeedback: unknown = row.revision_feedback
  if (typeof revisionFeedback === 'string') {
    try {
      revisionFeedback = JSON.parse(revisionFeedback)
    } catch {
      revisionFeedback = null
    }
  }
  if (!Array.isArray(revisionFeedback)) revisionFeedback = null
  return {
    ...row,
    depends_on: sanitizeDependsOn(row.depends_on),
    tags: sanitizeTags(row.tags),
    playground_enabled: !!row.playground_enabled,
    needs_review: !!row.needs_review,
    revision_feedback: revisionFeedback
  } as SprintTask
}

/**
 * Sanitize an array of task rows.
 */
export function mapRowsToTasks(rows: Record<string, unknown>[]): SprintTask[] {
  return rows.map(mapRowToTask)
}

/**
 * Serialize a value for SQLite storage:
 * - depends_on: JSON.stringify
 * - booleans: 1/0
 * - null prompt: ''
 */
export function serializeFieldForStorage(key: string, value: unknown): unknown {
  if (key === 'depends_on') {
    const sanitized = sanitizeDependsOn(value)
    return sanitized ? JSON.stringify(sanitized) : null
  }
  if (key === 'tags') {
    const sanitized = sanitizeTags(value)
    return sanitized ? JSON.stringify(sanitized) : null
  }
  if (key === 'revision_feedback') {
    if (value == null) return null
    if (typeof value === 'string') return value
    return JSON.stringify(value)
  }
  if (key === 'playground_enabled' || key === 'needs_review') {
    return value ? 1 : 0
  }
  if (key === 'prompt' && value == null) {
    return ''
  }
  return value
}
