/**
 * Extracts a string error message from an unknown error value.
 * @param err - The error value (can be Error, string, or any other type)
 * @returns The error message as a string
 */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
