/**
 * Canonical task status constants used across the application.
 * These are the single source of truth for status classification.
 */
export const TERMINAL_STATUSES = new Set(['done', 'cancelled', 'failed', 'error'])
export const FAILURE_STATUSES = new Set(['failed', 'error', 'cancelled'])
export const HARD_SATISFIED_STATUSES = new Set(['done'])

export const VALID_TRANSITIONS: Record<string, Set<string>> = {
  backlog: new Set(['queued', 'blocked', 'cancelled']),
  queued: new Set(['active', 'blocked', 'cancelled']),
  blocked: new Set(['queued', 'cancelled']),
  active: new Set(['review', 'done', 'failed', 'error', 'cancelled', 'queued']),
  review: new Set(['queued', 'done', 'cancelled']),
  done: new Set(['cancelled']),
  failed: new Set(['queued', 'cancelled']),
  error: new Set(['queued', 'cancelled']),
  cancelled: new Set([])
}

export function isValidTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.has(to)
}
