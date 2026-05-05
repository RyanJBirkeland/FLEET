import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'

interface MicroSparkProps {
  accent: string
  points: number[]
}

export function MicroSpark({ accent, points }: MicroSparkProps): React.JSX.Element {
  const reduced = useReducedMotion()
  const path = useMemo(() => {
    if (points.length < 2) return ''
    const max = Math.max(...points)
    const min = Math.min(...points)
    const range = max - min || 1
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * 100
        const y = 100 - ((p - min) / range) * 80 - 10
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [points])

  if (!path) return <div style={{ height: 18 }} />

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ width: '100%', height: 18 }}
      aria-hidden
    >
      <path
        d={path}
        stroke={`var(--st-${accent})`}
        strokeWidth={1.4}
        fill="none"
        vectorEffect="non-scaling-stroke"
        opacity={0.8}
        style={
          reduced
            ? {}
            : {
                strokeDasharray: 200,
                strokeDashoffset: 0
              }
        }
      />
    </svg>
  )
}
