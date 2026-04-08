import { getSetting } from './settings'

export function getGitHubToken(): string | null {
  return getSetting('github.token') ?? process.env['GITHUB_TOKEN'] ?? null
}

// F-t1-sre-1 / F-t3-model-2: Lowered default from 30 → 14 days. The audit
// found agent_events at 31K rows (~63 events per agent run). The Dashboard
// activity feed only reads the most recent rows, and the agent console
// replay rarely needs events older than a couple of weeks. Users can
// override via the agent.eventRetentionDays setting if they need longer
// history. Users with existing 30-day retention via setSetting are
// unaffected — only the default for new installs changes.
export function getEventRetentionDays(): number {
  return parseInt(getSetting('agent.eventRetentionDays') ?? '14', 10)
}
