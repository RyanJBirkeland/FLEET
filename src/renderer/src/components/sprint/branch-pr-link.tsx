import React from 'react'

// Security: BRANCH_PUSHED_PATTERN uses regex group captures to extract exactly the
// branch name and repo slug from the notes string. By extracting via groups rather
// than splitting on whitespace, any trailing tokens (injection attempts like
// "extra-garbage owner/repo") are silently ignored — only the captured groups
// are used to construct the URL, which is then individually validated by
// GH_REPO_PATTERN and GH_BRANCH_PATTERN before use.
export const GH_REPO_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/
export const GH_BRANCH_PATTERN = /^[a-zA-Z0-9/_.-]+$/
export const BRANCH_PUSHED_PATTERN = /Branch\s+(\S+)\s+pushed\s+to\s+(\S+)/

export function buildBranchOnlyPrLink(notes: string | null | undefined): React.ReactNode {
  if (!notes) return null
  const match = notes.match(BRANCH_PUSHED_PATTERN)
  if (!match) return null
  const [, branch, ghRepo] = match
  if (!branch || !ghRepo) return null
  if (!GH_REPO_PATTERN.test(ghRepo)) return null
  if (!GH_BRANCH_PATTERN.test(branch)) return null
  const href = `https://github.com/${encodeURIComponent(ghRepo)}/pull/new/${encodeURIComponent(branch)}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        alignSelf: 'flex-start',
        height: 24,
        padding: '0 var(--s-2)',
        background: 'var(--accent)',
        color: 'var(--accent-fg)',
        border: 'none',
        borderRadius: 'var(--r-md)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        textDecoration: 'none'
      }}
    >
      Create PR →
    </a>
  )
}
