import { useState, useEffect } from 'react'
import { getPRDiff } from '../../lib/github-api'
import { parseDiff, type DiffFile } from '../../lib/diff-parser'
import DiffViewer from '../diff/DiffViewer'

interface Props {
  owner: string
  repo: string
  prNumber: number
}

export default function PRStationDiff({ owner, repo, prNumber }: Props) {
  const [files, setFiles] = useState<DiffFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPRDiff(owner, repo, prNumber)
      .then((raw) => {
        if (cancelled) return
        setFiles(parseDiff(raw))
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load diff')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [owner, repo, prNumber])

  if (loading) {
    return (
      <div className="pr-diff-loading">
        <div className="sprint-board__skeleton" />
        <div className="sprint-board__skeleton" />
      </div>
    )
  }

  if (error) {
    return <div className="bde-error-banner">{error}</div>
  }

  const totalAdded = files.reduce((s, f) => s + f.additions, 0)
  const totalDeleted = files.reduce((s, f) => s + f.deletions, 0)

  return (
    <div className="pr-station-diff">
      <div className="pr-station-diff__header">
        <span>{files.length} files changed</span>
        <span className="diff-file__stats-add">+{totalAdded}</span>
        <span className="diff-file__stats-del">-{totalDeleted}</span>
      </div>
      <DiffViewer files={files} />
    </div>
  )
}
