import type { NeonAccent } from '../components/neon/types'

export interface FeedEvent {
  id: string
  label: string
  accent: NeonAccent
  timestamp: number
}
