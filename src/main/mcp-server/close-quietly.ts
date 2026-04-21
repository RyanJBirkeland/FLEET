import { logError, type Logger } from '../logger'

/**
 * Contract matched by anything with an async shutdown hook — the MCP
 * transport handler, the HTTP server wrapper, etc. Kept narrow on
 * purpose so shutdown code doesn't accidentally couple to wider APIs.
 */
export interface Closable {
  close: () => Promise<void> | void
}

/**
 * Awaits `closable.close()` and swallows any failure — logging the full
 * error with stack via `logError` instead. Used in shutdown paths where
 * one failing close must not prevent the rest of the teardown from
 * running, and where losing the stack to template-string interpolation
 * would hide a real bug.
 */
export async function closeQuietly(
  closable: Closable,
  label: string,
  logger: Logger
): Promise<void> {
  try {
    await closable.close()
  } catch (err) {
    logError(logger, `${label} close`, err)
  }
}
