/**
 * ErrorRegistry — groups circuit-breaker state and per-task drain-failure
 * counts behind a single named collaborator.
 *
 * Extracted from AgentManagerImpl so error tracking has its own SRP
 * boundary. The manager holds one instance and delegates to it for all
 * spawn-failure and drain-failure accounting.
 *
 * The underlying `CircuitBreaker` and `drainFailureCounts` map are still
 * owned here; `AgentManagerImpl` accesses them through this class.
 */

import { CircuitBreaker } from './circuit-breaker'
import type { Logger } from '../logger'

export class ErrorRegistry {
  readonly circuitBreaker: CircuitBreaker
  /** Per-task consecutive drain-loop failure counts. Cleared on success or quarantine. */
  readonly drainFailureCounts: Map<string, number>

  constructor(logger: Logger) {
    this.circuitBreaker = new CircuitBreaker(logger)
    this.drainFailureCounts = new Map()
  }

  /** True when the circuit breaker is currently open. */
  isCircuitOpen(now?: number): boolean {
    return this.circuitBreaker.isOpen(now)
  }

  /** Unix-ms timestamp at which the circuit breaker will re-close. */
  get circuitOpenUntil(): number {
    return this.circuitBreaker.openUntilTimestamp
  }

  recordSpawnSuccess(): void {
    this.circuitBreaker.recordSuccess()
  }

  recordSpawnFailure(taskId?: string, reason?: string): void {
    this.circuitBreaker.recordFailure(taskId, reason)
  }

  getDrainFailureCount(taskId: string): number {
    return this.drainFailureCounts.get(taskId) ?? 0
  }

  setDrainFailureCount(taskId: string, count: number): void {
    this.drainFailureCounts.set(taskId, count)
  }

  clearDrainFailureCount(taskId: string): void {
    this.drainFailureCounts.delete(taskId)
  }
}
