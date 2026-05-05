import type { StatusDotKind } from '../components/ui/StatusDot'

export function statusToDotKind(status: string, prStatus?: string | null): StatusDotKind {
  if (prStatus === 'open' || prStatus === 'branch_only') return 'review'
  if (status === 'active') return 'running'
  if (status === 'blocked') return 'blocked'
  if (status === 'review' || status === 'approved') return 'review'
  if (status === 'done') return 'done'
  if (status === 'failed' || status === 'error' || status === 'cancelled') return 'failed'
  return 'queued'
}
