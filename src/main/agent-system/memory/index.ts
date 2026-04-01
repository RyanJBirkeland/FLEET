import { ipcConventions } from './ipc-conventions'
import { testingPatterns } from './testing-patterns'
import { architectureRules } from './architecture-rules'

/**
 * Consolidate all memory modules into a single markdown string
 */
export function getAllMemory(): string {
  return [
    ipcConventions,
    testingPatterns,
    architectureRules
  ].join('\n\n---\n\n')
}
