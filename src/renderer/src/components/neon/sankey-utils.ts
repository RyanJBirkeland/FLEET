import type { NeonAccent } from './types'

/** Format count for display. Abbreviates 1000+ as "1.2k". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(1)}k`
}

export type SankeyStageKey = 'queued' | 'active' | 'review' | 'done' | 'blocked' | 'failed'

export interface StageConfig {
  accent: NeonAccent
  label: string
  /** Whether this is a "problem" stage (rendered smaller, below happy path) */
  problem: boolean
}

export const STAGE_CONFIG: Record<SankeyStageKey, StageConfig> = {
  queued: { accent: 'orange', label: 'QUEUED', problem: false },
  active: { accent: 'cyan', label: 'ACTIVE', problem: false },
  review: { accent: 'purple', label: 'REVIEW', problem: false },
  done: { accent: 'blue', label: 'DONE', problem: false },
  blocked: { accent: 'red', label: 'BLOCKED', problem: true },
  failed: { accent: 'red', label: 'FAILED', problem: true }
}

/** Happy path stage keys in flow order. */
export const HAPPY_PATH: SankeyStageKey[] = ['queued', 'active', 'review', 'done']
