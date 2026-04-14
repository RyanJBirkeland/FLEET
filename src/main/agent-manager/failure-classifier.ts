import type { FailureReason } from '../../shared/types'

const FAILURE_PATTERNS: Array<{ type: FailureReason; keywords: string[] }> = [
  {
    type: 'auth',
    keywords: ['invalid api key', 'authentication failed', 'unauthorized', 'token expired', 'invalid token']
  },
  {
    type: 'timeout',
    keywords: ['exceeded maximum runtime', 'timeout', 'timed out', 'watchdog']
  },
  {
    type: 'test_failure',
    keywords: ['npm test failed', 'test failed', 'vitest failed', 'jest failed', 'tests failed']
  },
  {
    type: 'compilation',
    keywords: ['compilation error', 'compilation failed', 'tsc failed', 'typescript error', 'type error', 'build failed']
  },
  {
    type: 'spawn',
    keywords: ['spawn failed', 'failed to spawn', 'enoent', 'command not found']
  }
]

export function classifyFailureReason(notes: string | undefined): FailureReason {
  if (!notes) return 'unknown'

  const lower = notes.toLowerCase()
  return FAILURE_PATTERNS.find(p => p.keywords.some(k => lower.includes(k)))?.type ?? 'unknown'
}
