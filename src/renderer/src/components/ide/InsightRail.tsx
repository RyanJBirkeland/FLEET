import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type * as monaco from 'monaco-editor'
import { IconBtn } from './IconBtn'
import { InsightSections } from './InsightSections'

// ---------------------------------------------------------------------------
// Module-level constant — avoids calling Date.now() during render
// ---------------------------------------------------------------------------

const FRESHNESS_INIT = Date.now()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InsightRailProps {
  activeFilePath: string | null
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>
  onClose: () => void
  rootPath: string | null
}

// ---------------------------------------------------------------------------
// Freshness label
// ---------------------------------------------------------------------------

function buildFreshnessLabel(lastRefreshed: number): string {
  const elapsedSeconds = Math.floor((Date.now() - lastRefreshed) / 1000)
  if (elapsedSeconds < 60) return `updated ${elapsedSeconds}s ago`
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  return `updated ${elapsedMinutes}m ago`
}

// ---------------------------------------------------------------------------
// InsightRail
// ---------------------------------------------------------------------------

export function InsightRail({
  activeFilePath,
  editorRef,
  onClose,
  rootPath
}: InsightRailProps): React.JSX.Element {
  const [lastRefreshed, setLastRefreshed] = useState(FRESHNESS_INIT)
  const [freshnessLabel, setFreshnessLabel] = useState('updated 0s ago')

  // Reset freshness timestamp whenever the active file changes.
  // Deferred with setTimeout so setLastRefreshed is not synchronous in the effect body.
  useEffect(() => {
    const t = setTimeout(() => setLastRefreshed(Date.now()), 0)
    return () => clearTimeout(t)
  }, [activeFilePath])

  // Update the displayed label every 30 seconds.
  // Deferred initial update to avoid synchronous setState in the effect body.
  useEffect(() => {
    const t = setTimeout(() => setFreshnessLabel(buildFreshnessLabel(lastRefreshed)), 0)
    const id = setInterval(() => {
      setFreshnessLabel(buildFreshnessLabel(lastRefreshed))
    }, 30_000)
    return () => {
      clearTimeout(t)
      clearInterval(id)
    }
  }, [lastRefreshed])

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        background: 'var(--surf-1)',
        borderLeft: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      <InsightRailHeader
        freshnessLabel={freshnessLabel}
        onClose={onClose}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeFilePath === null ? (
          <NoFileState />
        ) : (
          <InsightSections
            activeFilePath={activeFilePath}
            editorRef={editorRef}
            rootPath={rootPath}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

interface InsightRailHeaderProps {
  freshnessLabel: string
  onClose: () => void
}

function InsightRailHeader({ freshnessLabel, onClose }: InsightRailHeaderProps): React.JSX.Element {
  return (
    <div
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--s-3)',
        borderBottom: '1px solid var(--line)',
        flexShrink: 0
      }}
    >
      <span className="fleet-eyebrow">INSIGHTS</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--t-2xs)',
            color: 'var(--fg-3)'
          }}
        >
          {freshnessLabel}
        </span>
        <IconBtn icon={<X size={14} />} title="Close Insights (⌘⌥I)" onClick={onClose} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// No-file empty state
// ---------------------------------------------------------------------------

function NoFileState(): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--s-2)',
        padding: 'var(--s-5)'
      }}
    >
      <span className="fleet-eyebrow">OPEN A FILE</span>
      <span
        style={{
          fontSize: 'var(--t-sm)',
          color: 'var(--fg-3)',
          textAlign: 'center'
        }}
      >
        Insights will appear when you focus a file in the editor.
      </span>
    </div>
  )
}
