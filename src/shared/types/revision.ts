/**
 * Structured revision feedback — replaces freeform notes in retry prompts.
 *
 * Pipeline agents that fail pre-review verification receive a `RevisionFeedback`
 * object serialised into `task.notes` so the retry agent gets unambiguous,
 * machine-readable diagnostics instead of raw tool output.
 */

export interface RevisionFeedback {
  summary: string
  diagnostics: RevisionDiagnostic[]
}

export interface RevisionDiagnostic {
  /** Relative file path (e.g. `src/foo.ts`). */
  file: string
  /** 1-based line number when available. */
  line?: number
  kind: 'typecheck' | 'test' | 'missing-file' | 'syntax' | 'other'
  /** Verbatim tool output preferred. */
  message: string
  suggestedFix?: string
}

function isRevisionFeedback(value: unknown): value is RevisionFeedback {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.summary === 'string' &&
    Array.isArray(candidate.diagnostics)
  )
}

/**
 * Attempts to parse a task's notes field as RevisionFeedback.
 * Returns the parsed object on success, or null if the notes are not valid
 * RevisionFeedback JSON (e.g. legacy freeform strings).
 */
export function parseRevisionFeedback(notes: string | null | undefined): RevisionFeedback | null {
  if (!notes) return null
  try {
    const parsed: unknown = JSON.parse(notes)
    if (isRevisionFeedback(parsed)) return parsed
    return null
  } catch {
    return null
  }
}
