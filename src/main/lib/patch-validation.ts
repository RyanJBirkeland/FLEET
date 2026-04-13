/**
 * Filters a patch object to only include keys present in the allowlist.
 * Returns the filtered patch, or null if no valid keys remain.
 */
export function validateAndFilterPatch(
  patch: Record<string, unknown>,
  allowlist: Set<string>
): Record<string, unknown> | null {
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (allowlist.has(key)) {
      filtered[key] = value
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : null
}
