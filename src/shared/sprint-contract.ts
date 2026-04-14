import type { TaskStatus } from './task-state-machine'

// SSE event types
export type TaskUpdateEvent = {
  type: 'task:update'
  task: {
    taskId: string
    status: string
    pr_url?: string
    pr_number?: number
    completed_at?: string
  }
}
export type LogEvent = { type: 'log'; taskId: string; content: string }
export type DoneEvent = { type: 'done'; taskId: string }
export type SprintSSEEvent = TaskUpdateEvent | LogEvent | DoneEvent

// REST types
export type CreateTaskRequest = {
  title: string
  prompt: string
  priority?: number
  repo?: string
  spec?: string
}
export type UpdateTaskRequest = {
  status?: TaskStatus
  pr_url?: string
  pr_number?: number
}
export type TaskResponse = {
  id: string
  title: string
  status: string
  priority: number
  repo: string
  prompt: string
  spec?: string
  pr_url?: string
  pr_number?: number
  started_at?: string
  completed_at?: string
}
