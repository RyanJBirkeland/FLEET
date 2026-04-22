/**
 * Cross-platform path utilities for renderer-safe code.
 * Does NOT import node:path — safe to use in renderer process.
 */

/**
 * Extract the final component of a path, handling both POSIX and Windows separators.
 * Mimics node:path.basename behavior:
 * - Strips trailing slashes before extracting the basename
 * - Handles mixed separators (e.g., C:\\foo/bar)
 * - Returns empty string for empty input
 * - Returns the input itself if no separators are found
 *
 * @example
 * getBasename('/Users/ryan/Projects/foo/') // => 'foo'
 * getBasename('C:\\Users\\ryan\\Projects\\foo') // => 'foo'
 * getBasename('/Users/ryan/Projects/foo') // => 'foo'
 * getBasename('foo') // => 'foo'
 * getBasename('') // => ''
 * getBasename('/') // => ''
 * getBasename('C:\\') // => ''
 */
export function getBasename(filePath: string): string {
  if (!filePath) return ''

  // Normalize by replacing all backslashes with forward slashes
  const normalized = filePath.replace(/\\/g, '/')

  // Remove trailing slashes
  const trimmed = normalized.replace(/\/+$/, '')

  // If nothing left after trimming (was just slashes), return empty
  if (!trimmed) return ''

  // Split on remaining slashes and take the last segment
  const segments = trimmed.split('/')
  return segments[segments.length - 1] ?? ''
}
