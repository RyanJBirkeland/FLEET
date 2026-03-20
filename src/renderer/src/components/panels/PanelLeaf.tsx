import React, { Suspense } from 'react'
import { X } from 'lucide-react'
import { PanelLeafNode, View, usePanelLayoutStore } from '../../stores/panelLayout'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { tokens } from '../../design-system/tokens'
import { AgentsView } from '../../views/AgentsView'
import { TerminalView } from '../../views/TerminalView'

// ---------------------------------------------------------------------------
// Lazy-loaded views
// ---------------------------------------------------------------------------

const SprintView = React.lazy(() => import('../../views/SprintView'))
const MemoryView = React.lazy(() => import('../../views/MemoryView'))
const CostView = React.lazy(() => import('../../views/CostView'))
const SettingsView = React.lazy(() => import('../../views/SettingsView'))
const PRStationView = React.lazy(() => import('../../views/PRStationView'))

// ---------------------------------------------------------------------------
// View registry
// ---------------------------------------------------------------------------

function resolveView(viewKey: View): React.ReactNode {
  switch (viewKey) {
    case 'agents':
      return <AgentsView />
    case 'terminal':
      return <TerminalView />
    case 'sprint':
      return <SprintView />
    case 'memory':
      return <MemoryView />
    case 'cost':
      return <CostView />
    case 'settings':
      return <SettingsView />
    case 'pr-station':
      return <PRStationView />
  }
}

// ---------------------------------------------------------------------------
// ViewSkeleton — pulsing loading fallback
// ---------------------------------------------------------------------------

function ViewSkeleton(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: tokens.radius.full,
          background: tokens.color.surfaceHigh,
          animation: 'bde-pulse 1.2s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes bde-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

interface TabBarProps {
  node: PanelLeafNode
  onTabClick: (index: number) => void
  onTabClose: (index: number, e: React.MouseEvent) => void
}

function TabBar({ node, onTabClick, onTabClose }: TabBarProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '28px',
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {node.tabs.map((tab, index) => {
        const isActive = index === node.activeTab
        return (
          <div
            key={`${tab.viewKey}-${index}`}
            onClick={() => onTabClick(index)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.space[1],
              padding: `0 ${tokens.space[2]}`,
              height: '100%',
              cursor: 'pointer',
              background: isActive ? tokens.color.surfaceHigh : 'transparent',
              color: isActive ? tokens.color.text : tokens.color.textMuted,
              fontSize: tokens.size.sm,
              fontFamily: tokens.font.ui,
              borderRight: `1px solid ${tokens.color.border}`,
              userSelect: 'none',
              whiteSpace: 'nowrap',
              transition: `color ${tokens.transition.fast}`,
            }}
          >
            <span>{tab.label}</span>
            <button
              onClick={(e) => onTabClose(index, e)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                color: 'inherit',
                opacity: 0.6,
                lineHeight: 1,
              }}
              aria-label={`Close ${tab.label}`}
            >
              <X size={11} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PanelLeaf
// ---------------------------------------------------------------------------

interface PanelLeafProps {
  node: PanelLeafNode
}

export function PanelLeaf({ node }: PanelLeafProps): React.ReactElement {
  const focusedPanelId = usePanelLayoutStore((s) => s.focusedPanelId)
  const focusPanel = usePanelLayoutStore((s) => s.focusPanel)
  const setActiveTab = usePanelLayoutStore((s) => s.setActiveTab)
  const closeTab = usePanelLayoutStore((s) => s.closeTab)

  const isFocused = focusedPanelId === node.panelId

  function handleTabClick(index: number): void {
    focusPanel(node.panelId)
    setActiveTab(node.panelId, index)
  }

  function handleTabClose(index: number, e: React.MouseEvent): void {
    e.stopPropagation()
    closeTab(node.panelId, index)
  }

  function handlePanelClick(): void {
    focusPanel(node.panelId)
  }

  return (
    <div
      onClick={handlePanelClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: tokens.color.surface,
        outline: isFocused ? `1px solid ${tokens.color.accent}` : '1px solid transparent',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {node.tabs.length > 1 && (
        <TabBar node={node} onTabClick={handleTabClick} onTabClose={handleTabClose} />
      )}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {node.tabs.map((tab, index) => {
          const isActive = index === node.activeTab
          return (
            <div
              key={`${tab.viewKey}-${index}`}
              style={{
                position: 'absolute',
                inset: 0,
                display: isActive ? 'flex' : 'none',
                flexDirection: 'column',
              }}
            >
              <ErrorBoundary name={tab.label}>
                <Suspense fallback={<ViewSkeleton />}>{resolveView(tab.viewKey)}</Suspense>
              </ErrorBoundary>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PanelLeaf
