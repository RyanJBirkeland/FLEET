/** CSS color string (var(--…) or hex) used to tint a feed event dot. */
export type EpicAccent = string

export interface FeedEvent {
  id: string
  label: string
  accent: EpicAccent
  timestamp: number
}

export interface DashboardStats {
  active: number
  queued: number
  blocked: number
  review: number
  done: number
  doneToday: number
  failed: number
  actualFailed: number
}

export interface ChartBar {
  value: number
  accent?: string | undefined
  label?: string | undefined
}
