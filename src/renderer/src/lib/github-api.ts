let cachedToken: string | null = null

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken
  const token = await window.api.getGitHubToken()
  if (!token) throw new Error('GitHub token not configured')
  cachedToken = token
  return token
}

async function githubFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken()
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...init?.headers
    }
  })
}

export interface PullRequest {
  number: number
  title: string
  html_url: string
  state: string
  draft: boolean
  created_at: string
  updated_at: string
  head: { ref: string; sha: string }
  base: { ref: string }
  user: { login: string }
  additions: number
  deletions: number
  repo: string
}

export async function listOpenPRs(owner: string, repo: string): Promise<PullRequest[]> {
  const res = await githubFetch(`/repos/${owner}/${repo}/pulls?state=open&per_page=20`)
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const data = await res.json()
  return (data as PullRequest[]).map((pr) => ({ ...pr, repo }))
}

export async function mergePR(owner: string, repo: string, number: number): Promise<void> {
  const token = await getToken()
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/merge`,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ merge_method: 'squash' })
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Merge failed: ${res.status} — ${(err as { message?: string }).message ?? 'unknown'}`
    )
  }
}
