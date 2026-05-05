import { useState } from 'react'
import { SquareTerminal, PanelRight, Columns2, ExternalLink } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useIDEStore } from '../../stores/ide'
import { IconBtn } from './IconBtn'

export interface ContextBarProps {
  activeTabId: string | null
  terminalOpen: boolean
  insightOpen: boolean
  onToggleTerminal: () => void
  onToggleInsight: () => void
}

export function ContextBar({
  activeTabId,
  terminalOpen,
  insightOpen,
  onToggleTerminal,
  onToggleInsight
}: ContextBarProps): React.JSX.Element {
  return (
    <div
      style={{
        height: 32,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
        padding: '0 var(--s-3)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-3)',
        justifyContent: 'space-between',
        flexShrink: 0
      }}
    >
      <Breadcrumbs activeTabId={activeTabId} />
      <ToolbarActions
        terminalOpen={terminalOpen}
        insightOpen={insightOpen}
        onToggleTerminal={onToggleTerminal}
        onToggleInsight={onToggleInsight}
      />
    </div>
  )
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

interface BreadcrumbsProps {
  activeTabId: string | null
}

function Breadcrumbs({ activeTabId }: BreadcrumbsProps): React.JSX.Element | null {
  const { openTabs, rootPath } = useIDEStore(
    useShallow((s) => ({
      openTabs: s.openTabs,
      rootPath: s.rootPath
    }))
  )

  const activeTab = openTabs.find((t) => t.id === activeTabId)
  if (!activeTab) return null

  const segments = buildBreadcrumbSegments(activeTab.filePath, rootPath)
  if (segments.length === 0) return null

  return (
    <nav
      aria-label="File path"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-1)',
        minWidth: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap'
      }}
    >
      {segments.map((segment, index) => (
        <BreadcrumbSegment
          key={`${segment}-${index}`}
          label={segment}
          isLast={index === segments.length - 1}
          showSeparator={index > 0}
        />
      ))}
    </nav>
  )
}

function buildBreadcrumbSegments(filePath: string, rootPath: string | null): string[] {
  const trimmed =
    rootPath && filePath.startsWith(rootPath)
      ? filePath.slice(rootPath.length).replace(/^\//, '')
      : filePath
  return trimmed.split('/').filter((s) => s.length > 0)
}

// ─── Breadcrumb segment ───────────────────────────────────────────────────────

interface BreadcrumbSegmentProps {
  label: string
  isLast: boolean
  showSeparator: boolean
}

function BreadcrumbSegment({
  label,
  isLast,
  showSeparator
}: BreadcrumbSegmentProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const isInteractive = isLast
  const showHoverBg = isInteractive && hovered

  return (
    <>
      {showSeparator && (
        <span
          aria-hidden="true"
          style={{
            color: 'var(--fg-4)',
            fontSize: 'var(--t-sm)',
            padding: '0 var(--s-1)'
          }}
        >
          ›
        </span>
      )}
      <button
        type="button"
        // TODO(phase-6.5): wire last-segment click to file picker
        onClick={undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          color: isLast ? 'var(--fg)' : 'var(--fg-3)',
          fontSize: 'var(--t-sm)',
          padding: '0 var(--s-1)',
          borderRadius: 'var(--r-sm)',
          background: showHoverBg ? 'var(--surf-2)' : 'transparent',
          border: 'none',
          cursor: isInteractive ? 'pointer' : 'default',
          fontFamily: 'inherit'
        }}
      >
        {label}
      </button>
    </>
  )
}

// ─── Toolbar actions ──────────────────────────────────────────────────────────

interface ToolbarActionsProps {
  terminalOpen: boolean
  insightOpen: boolean
  onToggleTerminal: () => void
  onToggleInsight: () => void
}

function ToolbarActions({
  terminalOpen,
  insightOpen,
  onToggleTerminal,
  onToggleInsight
}: ToolbarActionsProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-1)',
        flexShrink: 0
      }}
    >
      <IconBtn
        icon={<SquareTerminal size={14} />}
        title="Toggle Terminal (⌘J)"
        active={terminalOpen}
        onClick={onToggleTerminal}
      />
      <IconBtn
        icon={<PanelRight size={14} />}
        title="Toggle Insights (⌘⌥I)"
        active={insightOpen}
        onClick={onToggleInsight}
      />
      <IconBtn
        icon={<Columns2 size={14} />}
        title="Split Editor"
        onClick={() => {
          /* TODO(phase-6.5): split editor */
        }}
      />
      <IconBtn
        icon={<ExternalLink size={14} />}
        title="Open in Editor"
        onClick={() => {
          /* TODO(phase-6.5): open external editor */
        }}
      />
    </div>
  )
}
