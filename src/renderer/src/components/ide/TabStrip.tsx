import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import type { EditorTab } from '../../stores/ide'
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex'

export interface TabStripProps {
  tabs: EditorTab[]
  activeTabId: string | null
  onActivate: (tabId: string) => void
  onClose: (tabId: string, isDirty: boolean) => void
  onNewFile?: (() => void) | undefined
}

const TAB_HEIGHT = 36

export function TabStrip({
  tabs,
  activeTabId,
  onActivate,
  onClose,
  onNewFile
}: TabStripProps): React.JSX.Element {
  const activeTabIndex = tabs.findIndex((t) => t.id === activeTabId)
  const { getTabProps } = useRovingTabIndex({
    count: tabs.length,
    activeIndex: activeTabIndex >= 0 ? activeTabIndex : 0,
    onSelect: (index) => {
      const target = tabs[index]
      if (target) onActivate(target.id)
    }
  })

  return (
    <div
      role="tablist"
      aria-label="Editor tabs"
      style={{
        height: TAB_HEIGHT,
        background: 'var(--surf-1)',
        borderBottom: '1px solid var(--line)',
        padding: '0 var(--s-2)',
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        flexShrink: 0
      }}
    >
      {tabs.map((tab, index) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onActivate={onActivate}
          onClose={onClose}
          tabProps={getTabProps(index)}
        />
      ))}
      {onNewFile && <NewFileButton onClick={onNewFile} />}
    </div>
  )
}

// ─── Tab row ──────────────────────────────────────────────────────────────────

interface TabProps {
  tab: EditorTab
  isActive: boolean
  onActivate: (tabId: string) => void
  onClose: (tabId: string, isDirty: boolean) => void
  tabProps: { tabIndex: number; onKeyDown: (e: React.KeyboardEvent) => void }
}

function Tab({ tab, isActive, onActivate, onClose, tabProps }: TabProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)

  const showCloseGlyph = hovered || (isActive && !tab.isDirty)
  const showDirtyDot = tab.isDirty && !hovered

  return (
    <div
      role="tab"
      aria-selected={isActive}
      title={tab.filePath}
      onClick={() => onActivate(tab.id)}
      onAuxClick={(e) => {
        if (e.button === 1) onClose(tab.id, tab.isDirty)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: TAB_HEIGHT,
        padding: '0 var(--s-3)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderRight: '1px solid var(--line)',
        minWidth: 120,
        maxWidth: 220,
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        background: isActive ? 'var(--bg)' : hovered ? 'var(--surf-2)' : 'var(--surf-1)',
        color: isActive ? 'var(--fg)' : hovered ? 'var(--fg-2)' : 'var(--fg-3)',
        transition:
          'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)'
      }}
      {...tabProps}
    >
      {isActive && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'var(--accent)',
            borderRadius: '2px 2px 0 0'
          }}
        />
      )}
      {showDirtyDot && <DirtyDot />}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 'var(--t-sm)'
        }}
      >
        {tab.displayName}
      </span>
      {showCloseGlyph && <CloseButton tab={tab} onClose={onClose} />}
    </div>
  )
}

// ─── Dirty dot ────────────────────────────────────────────────────────────────

function DirtyDot(): React.JSX.Element {
  return (
    <span
      aria-label="unsaved changes"
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--accent)',
        flexShrink: 0
      }}
    />
  )
}

// ─── Close button ─────────────────────────────────────────────────────────────

interface CloseButtonProps {
  tab: EditorTab
  onClose: (tabId: string, isDirty: boolean) => void
}

function CloseButton({ tab, onClose }: CloseButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={`Close ${tab.displayName}`}
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation()
        onClose(tab.id, tab.isDirty)
      }}
      style={{
        width: 16,
        height: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: 'inherit',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0
      }}
    >
      <X size={12} />
    </button>
  )
}

// ─── New file (+) button ──────────────────────────────────────────────────────

interface NewFileButtonProps {
  onClick: () => void
}

function NewFileButton({ onClick }: NewFileButtonProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      title="New File"
      aria-label="New File"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: TAB_HEIGHT,
        height: TAB_HEIGHT,
        flexShrink: 0,
        background: hovered ? 'var(--surf-2)' : 'transparent',
        color: hovered ? 'var(--fg-2)' : 'var(--fg-3)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition:
          'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)'
      }}
    >
      <Plus size={14} />
    </button>
  )
}

export type { EditorTab }
