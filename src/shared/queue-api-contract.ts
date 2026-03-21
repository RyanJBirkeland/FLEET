/**
 * TaskQueueAPI request/response types.
 * Shared between BDE (server) and task runner (client).
 */

export interface QueueHealthResponse {
  status: 'ok'
  version: string
  queue: {
    backlog: number
    queued: number
    active: number
    done: number
    failed: number
    cancelled: number
  }
}

export interface ClaimRequest {
  executorId: string
}

export interface StatusUpdateRequest {
  status: 'active' | 'done' | 'failed' | 'cancelled' | 'error'
  pr_url?: string
  pr_number?: number
  pr_status?: 'open' | 'merged' | 'closed' | 'draft'
  completed_at?: string
  agent_run_id?: string
  retry_count?: number
  fast_fail_count?: number
  notes?: string
}

/** Runner-writable status values for PATCH /queue/tasks/:id/status */
export const RUNNER_WRITABLE_STATUSES = new Set(['active', 'done', 'failed', 'cancelled', 'error'])

/** Allowed fields in a status update patch */
export const STATUS_UPDATE_FIELDS = new Set([
  'status',
  'pr_url',
  'pr_number',
  'pr_status',
  'completed_at',
  'agent_run_id',
  'retry_count',
  'fast_fail_count',
  'notes',
])

// --- Streaming Visibility Event Types ---

/** All possible event type discriminators */
export type TaskOutputEventType =
  | 'agent:started'
  | 'agent:tool_call'
  | 'agent:tool_result'
  | 'agent:thinking'
  | 'agent:rate_limited'
  | 'agent:error'
  | 'agent:completed'

/** Base event shape — all specific events extend this */
export interface TaskOutputEvent {
  taskId: string
  timestamp: string // ISO 8601
  type: TaskOutputEventType | string // string for forward-compat with unknown types
}

/** Agent started executing */
export interface AgentStartedEvent extends TaskOutputEvent {
  type: 'agent:started'
  model: string
}

/** Agent invoked a tool */
export interface AgentToolCallEvent extends TaskOutputEvent {
  type: 'agent:tool_call'
  tool: string
  summary: string
  input?: string
}

/** Tool returned a result */
export interface AgentToolResultEvent extends TaskOutputEvent {
  type: 'agent:tool_result'
  tool: string
  success: boolean
  summary: string
}

/** Agent is thinking / processing tokens */
export interface AgentThinkingEvent extends TaskOutputEvent {
  type: 'agent:thinking'
  tokenCount: number
}

/** API rate limited */
export interface AgentRateLimitedEvent extends TaskOutputEvent {
  type: 'agent:rate_limited'
  retryDelayMs: number
  attempt: number
}

/** Agent encountered an error */
export interface AgentErrorEvent extends TaskOutputEvent {
  type: 'agent:error'
  message: string
}

/** Agent finished execution */
export interface AgentCompletedEvent extends TaskOutputEvent {
  type: 'agent:completed'
  exitCode: number
  costUsd: number | null
  tokensIn: number | null
  tokensOut: number | null
  durationMs: number
}

// --- Health Monitoring Types ---

export type HealthCondition = 'healthy' | 'degraded' | 'unhealthy'

export interface RecentHealth {
  windowMinutes: number
  agentExits: { total: number; done: number; failed: number; error: number }
  successRate: number | null
  avgDurationMs: number | null
  rateLimits: number
  stalls: number
  fastFails: number
  condition: HealthCondition
}

export interface HealthDegradedPayload {
  previousCondition: HealthCondition
  currentCondition: HealthCondition
  recentHealth: RecentHealth
}
