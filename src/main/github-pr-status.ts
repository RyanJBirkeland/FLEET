import { parsePrUrl } from '../shared/github'
import { getGitHubToken } from './config'
import { githubFetchJson } from './github-fetch'

export interface PrStatusInput {
  taskId: string
  prUrl: string
}

export interface PrStatusResult {
  taskId: string
  merged: boolean
  state: string
  mergedAt: string | null
  mergeableState: string | null
}

async function fetchPrStatusRest(pr: PrStatusInput): Promise<PrStatusResult> {
  const errorResult: PrStatusResult = {
    taskId: pr.taskId,
    merged: false,
    state: 'error',
    mergedAt: null,
    mergeableState: null
  }
  const parsed = parsePrUrl(pr.prUrl)
  if (!parsed)
    return {
      taskId: pr.taskId,
      merged: false,
      state: 'unknown',
      mergedAt: null,
      mergeableState: null
    }

  const result = await githubFetchJson<{
    state: string
    merged_at: string | null
    mergeable_state?: string
  }>(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
    getGitHubToken() ?? null,
    { timeoutMs: 10_000 }
  )
  // Error details (kind, message) were already logged + broadcast by
  // githubFetchJson. The UI will see a `github:error` toast for transient
  // failures and can surface its own classification. We return the generic
  // `error` sentinel so the poller keeps its existing state semantics.
  if (!result.ok) return errorResult

  const data = result.data
  const merged = data.state === 'closed' && data.merged_at !== null
  const state = data.merged_at ? 'MERGED' : data.state.toUpperCase()
  const mergeableState = data.mergeable_state ?? null
  return { taskId: pr.taskId, merged, state, mergedAt: data.merged_at ?? null, mergeableState }
}

export async function pollPrStatuses(prs: PrStatusInput[]): Promise<PrStatusResult[]> {
  return Promise.all(prs.map(fetchPrStatusRest))
}
