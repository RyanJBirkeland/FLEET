import { FAST_FAIL_THRESHOLD_MS, MAX_FAST_FAILS } from './types'

export type FastFailResult = 'normal-exit' | 'fast-fail-requeue' | 'fast-fail-exhausted'

export function classifyExit(spawnedAt: number, exitedAt: number, currentFastFailCount: number): FastFailResult {
  if (exitedAt - spawnedAt >= FAST_FAIL_THRESHOLD_MS) return 'normal-exit'
  const newCount = currentFastFailCount + 1
  return newCount >= MAX_FAST_FAILS ? 'fast-fail-exhausted' : 'fast-fail-requeue'
}
