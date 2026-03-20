/**
 * useSessionsKeyboardShortcuts — split-mode and pane-focus keyboard shortcuts.
 * Cmd+Shift+1/2/4 → split mode, Cmd+Opt+Arrow → focus pane.
 */
import { useEffect, useCallback } from 'react'
import { useSplitLayoutStore, type SplitMode } from '../stores/splitLayout'
import { useUIStore } from '../stores/ui'

interface SessionsKeyboardShortcutsResult {
  handleSplitModeChange: (mode: SplitMode) => void
}

export function useSessionsKeyboardShortcuts(
  selectedKey: string | null
): SessionsKeyboardShortcutsResult {
  const splitMode = useSplitLayoutStore((s) => s.splitMode)
  const setSplitMode = useSplitLayoutStore((s) => s.setSplitMode)
  const splitPanes = useSplitLayoutStore((s) => s.splitPanes)
  const focusedPaneIndex = useSplitLayoutStore((s) => s.focusedPaneIndex)
  const setFocusedPane = useSplitLayoutStore((s) => s.setFocusedPane)
  const setPaneSession = useSplitLayoutStore((s) => s.setPaneSession)
  const activeView = useUIStore((s) => s.activeView)

  const handleSplitModeChange = useCallback((mode: SplitMode): void => {
    if (mode === 'single') {
      setSplitMode('single')
      return
    }
    if (selectedKey && splitPanes[0] === null) {
      setPaneSession(0, selectedKey)
    }
    setSplitMode(mode)
  }, [selectedKey, splitPanes, setSplitMode, setPaneSession])

  useEffect(() => {
    if (activeView !== ('sessions' as string)) return

    const handler = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Cmd+Shift+1/2/4 → split mode
      if (e.metaKey && e.shiftKey && !e.altKey) {
        if (e.key === '1' || e.key === '!') {
          e.preventDefault()
          handleSplitModeChange('single')
          return
        }
        if (e.key === '2' || e.key === '@') {
          e.preventDefault()
          handleSplitModeChange('2-pane')
          return
        }
        if (e.key === '4' || e.key === '$') {
          e.preventDefault()
          handleSplitModeChange('grid-4')
          return
        }
      }

      // Cmd+Opt+Arrow → focus pane
      if (e.metaKey && e.altKey) {
        const maxPanes = splitMode === 'grid-4' ? 4 : splitMode === '2-pane' ? 2 : 1
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setFocusedPane(Math.max(0, focusedPaneIndex - 1))
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          setFocusedPane(Math.min(maxPanes - 1, focusedPaneIndex + 1))
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeView, splitMode, focusedPaneIndex, handleSplitModeChange, setFocusedPane])

  return { handleSplitModeChange }
}
