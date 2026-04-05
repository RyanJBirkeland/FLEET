import { NeonCard } from '../neon'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'

interface FailureReasonRow {
  reason: string
  count: number
}

/** Shows failure reason breakdown from sprint tasks. */
export function FailureBreakdown(): React.JSX.Element {
  const [data, setData] = useState<FailureReasonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async (): Promise<void> => {
      try {
        setLoading(true)
        setError(null)
        const result = await window.api.sprint.failureBreakdown()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  const totalFailures = data.reduce((sum, row) => sum + row.count, 0)

  return (
    <NeonCard accent="red" title="Failure Breakdown" icon={<AlertTriangle size={12} />}>
      {loading ? (
        <div className="dashboard-card-loading">Loading...</div>
      ) : error ? (
        <div className="dashboard-card-error">
          <div className="dashboard-card-error__message">{error}</div>
        </div>
      ) : totalFailures === 0 ? (
        <div className="dashboard-failure-breakdown-empty">No failures</div>
      ) : (
        <div className="dashboard-failure-breakdown-list">
          {data.map((row) => (
            <div key={row.reason} className="dashboard-failure-breakdown-row">
              <span className="dashboard-failure-breakdown-reason">{row.reason}</span>
              <span className="dashboard-failure-breakdown-count">{row.count}</span>
            </div>
          ))}
        </div>
      )}
    </NeonCard>
  )
}
