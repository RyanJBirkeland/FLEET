import './ThroughputCard.css'
import { useMemo } from 'react'
import { Card } from '../primitives/Card'
import { CardHead } from '../primitives/CardHead'
import type { CompletionBucket } from '../../../../../shared/ipc-channels'

interface ThroughputCardProps {
  throughputData: CompletionBucket[]
}

function buildBars(throughputData: CompletionBucket[]): number[] {
  if (throughputData.length === 0) return Array(24).fill(0)
  return throughputData.map((b) => b.successCount + b.failedCount)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function computeDelta(throughputData: CompletionBucket[]): number | null {
  if (throughputData.length < 2) return null
  const now = new Date()
  const todayHour = now.getHours()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  // Compare today's completed to the same window yesterday
  const todayBuckets = throughputData.filter((b) => isSameDay(new Date(b.hour), now))
  const yesterdayBuckets = throughputData.filter((b) => {
    const h = new Date(b.hour)
    return isSameDay(h, yesterday) && h.getHours() <= todayHour
  })
  const todayTotal = todayBuckets.reduce((s, b) => s + b.successCount + b.failedCount, 0)
  const yesterdayTotal = yesterdayBuckets.reduce((s, b) => s + b.successCount + b.failedCount, 0)
  if (yesterdayTotal === 0 && todayTotal === 0) return null
  return todayTotal - yesterdayTotal
}

export function ThroughputCard({ throughputData }: ThroughputCardProps): React.JSX.Element {
  const bars = useMemo(() => buildBars(throughputData), [throughputData])
  const total = useMemo(() => bars.reduce((s, n) => s + n, 0), [bars])
  const maxBar = useMemo(() => Math.max(...bars, 1), [bars])
  const delta = useMemo(() => computeDelta(throughputData), [throughputData])

  const deltaEl =
    delta == null ? null : (
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: delta >= 0 ? 'var(--st-done)' : 'var(--st-failed)'
        }}
      >
        {delta >= 0 ? '+' : ''}
        {delta} vs yesterday
      </span>
    )

  const chartLabel =
    delta == null
      ? `24-hour throughput chart: ${total} tasks completed`
      : `24-hour throughput chart: ${total} tasks completed, ${delta >= 0 ? '+' : ''}${delta} versus yesterday`

  return (
    <Card>
      <CardHead eyebrow="Throughput · 24h" title={`${total} completed`} right={deltaEl} />
      <div className="throughput__chart" role="img" aria-label={chartLabel}>
        {bars.map((h, i) => (
          <div
            key={i}
            className="throughput__bar"
            style={{
              height: `${(h / maxBar) * 100}%`,
              opacity: i === bars.length - 1 ? 1 : 0.5
            }}
          />
        ))}
      </div>
      <div className="throughput__axis">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>now</span>
      </div>
    </Card>
  )
}
