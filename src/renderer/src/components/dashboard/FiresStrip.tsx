import React from 'react'
import './FiresStrip.css'

interface LoadSaturation {
  load1: number
  cpuCount: number
}

interface FiresStripProps {
  failed: number
  blocked: number
  stuck: number
  loadSaturated: LoadSaturation | null
  onClick: (kind: 'failed' | 'blocked' | 'stuck' | 'load') => void
}

export function FiresStrip({
  failed,
  blocked,
  stuck,
  loadSaturated,
  onClick
}: FiresStripProps): React.JSX.Element | null {
  if (failed === 0 && blocked === 0 && stuck === 0 && loadSaturated === null) {
    return null
  }

  const segments: React.JSX.Element[] = []

  if (failed > 0) {
    segments.push(
      <button
        key="failed"
        type="button"
        aria-label={`${failed} failed task${failed === 1 ? '' : 's'}`}
        className="fires-strip__alert"
        onClick={() => onClick('failed')}
      >
        {failed} failed
      </button>
    )
  }

  if (blocked > 0) {
    segments.push(
      <button
        key="blocked"
        type="button"
        aria-label={`${blocked} blocked task${blocked === 1 ? '' : 's'}`}
        className="fires-strip__alert"
        onClick={() => onClick('blocked')}
      >
        {blocked} blocked
      </button>
    )
  }

  if (stuck > 0) {
    segments.push(
      <button
        key="stuck"
        type="button"
        aria-label={`${stuck} stuck task${stuck === 1 ? '' : 's'}`}
        className="fires-strip__alert"
        onClick={() => onClick('stuck')}
      >
        {stuck} stuck &gt;1h
      </button>
    )
  }

  if (loadSaturated) {
    segments.push(
      <button
        key="load"
        type="button"
        aria-label={`load ${Math.round(loadSaturated.load1)} / ${loadSaturated.cpuCount} cores`}
        className="fires-strip__alert"
        onClick={() => onClick('load')}
      >
        load {Math.round(loadSaturated.load1)} / {loadSaturated.cpuCount} cores
      </button>
    )
  }

  const withSeparators: React.JSX.Element[] = []
  segments.forEach((seg, i) => {
    if (i > 0) {
      withSeparators.push(
        <span key={`sep-${i}`} className="fires-strip__separator" aria-hidden="true">
          ·
        </span>
      )
    }
    withSeparators.push(seg)
  })

  return (
    <div role="region" aria-label="Dashboard alerts" className="fires-strip">
      <strong style={{ marginRight: 6 }}><span aria-hidden="true">⚠</span> ATTENTION</strong>
      {withSeparators}
    </div>
  )
}
