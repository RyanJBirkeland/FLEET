/**
 * Returns current timestamp in ISO 8601 format.
 * Centralized for DRY compliance and test-time injection.
 */
export function nowIso(): string {
  return new Date().toISOString()
}
