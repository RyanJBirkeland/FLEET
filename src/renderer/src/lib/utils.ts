/**
 * Convert a working directory path to a short repo label for display.
 * Returns the last path component, working on both Unix and Windows paths.
 */
export function cwdToRepoLabel(cwd: string | null): string {
  if (!cwd) return 'unknown'
  const parts = cwd.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? cwd
}

/**
 * CSS color-mix() helper: blend `color` at `opacity` percent with transparent.
 * Works with any CSS color format (hex, rgb, hsl, named). Replaces the brittle
 * hex-only `${color}20` string-concatenation alpha hack.
 */
export function withAlpha(color: string, opacity: number): string {
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`
}
